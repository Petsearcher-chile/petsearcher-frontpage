import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export const runtime = "nodejs";

type AddressRow = {
  id: string;
  longitude: number;
  latitude: number;
  full_address: string;
};

type PetLossRow = {
  id: number;
  id_address: string | null;
  nombre_mascota: string | null;
};

type PetPhotoRow = {
  id_perdida: number;
  id_file: string | null;
  id_file_miniatura: string | null;
};

type FileRow = {
  id: string;
  storage_key: string | null;
  bucket_name: string | null;
  url: string | null;
};

const parseNumber = (value: string | null) => {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function GET(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      { message: "Faltan variables de entorno de Supabase." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const minLongitude = parseNumber(searchParams.get("minLongitude"));
  const maxLongitude = parseNumber(searchParams.get("maxLongitude"));
  const minLatitude = parseNumber(searchParams.get("minLatitude"));
  const maxLatitude = parseNumber(searchParams.get("maxLatitude"));

  if (
    minLongitude === null ||
    maxLongitude === null ||
    minLatitude === null ||
    maxLatitude === null
  ) {
    return Response.json(
      { message: "Parámetros de límites inválidos." },
      { status: 400 },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: addresses, error: addressesError } = await supabase
    .from("mapbox_addresses")
    .select("id, longitude, latitude, full_address")
    .gt("longitude", minLongitude)
    .lt("longitude", maxLongitude)
    .gt("latitude", minLatitude)
    .lt("latitude", maxLatitude)
    .limit(300);

  if (addressesError) {
    return Response.json(
      { message: "No se pudieron consultar direcciones.", detail: addressesError.message },
      { status: 500 },
    );
  }

  const addressRows = (addresses ?? []) as AddressRow[];
  if (addressRows.length === 0) {
    return Response.json({ markers: [] });
  }

  const addressIds = addressRows.map((address) => address.id);
  const addressById = new Map(addressRows.map((address) => [address.id, address]));

  const { data: petLosses, error: petLossesError } = await supabase
    .from("pet_perdida")
    .select("id, id_address, nombre_mascota")
    .eq("estado", "registrada")
    .in("id_address", addressIds)
    .limit(300);

  if (petLossesError) {
    return Response.json(
      { message: "No se pudieron consultar pérdidas.", detail: petLossesError.message },
      { status: 500 },
    );
  }

  const petRows = (petLosses ?? []) as PetLossRow[];
  if (petRows.length === 0) {
    return Response.json({ markers: [] });
  }

  const petLossIds = petRows.map((pet) => pet.id);

  const { data: petPhotos, error: petPhotosError } = await supabase
    .from("pet_perdida_fotos")
    .select("id_perdida, id_file, id_file_miniatura")
    .in("id_perdida", petLossIds);

  if (petPhotosError) {
    return Response.json(
      { message: "No se pudieron consultar fotos.", detail: petPhotosError.message },
      { status: 500 },
    );
  }

  const photoRows = (petPhotos ?? []) as PetPhotoRow[];
  const filesByPet = new Map<number, { originalId: string; miniId: string }[]>();
  for (const row of photoRows) {
    if (!row.id_file || !row.id_file_miniatura) {
      continue;
    }
    const current = filesByPet.get(row.id_perdida) ?? [];
    current.push({
      originalId: row.id_file,
      miniId: row.id_file_miniatura,
    });
    filesByPet.set(row.id_perdida, current);
  }

  const fileIds = Array.from(
    new Set(
      Array.from(filesByPet.values()).flatMap((fileIdsByPet) =>
        fileIdsByPet.flatMap((entry) => [entry.originalId, entry.miniId]),
      ),
    ),
  );
  let fileById = new Map<string, FileRow>();

  if (fileIds.length > 0) {
    const { data: files, error: filesError } = await supabase
      .from("files")
      .select("id, storage_key, bucket_name, url")
      .in("id", fileIds);

    if (filesError) {
      return Response.json(
        { message: "No se pudieron consultar archivos.", detail: filesError.message },
        { status: 500 },
      );
    }

    fileById = new Map(((files ?? []) as FileRow[]).map((file) => [file.id, file]));
  }

  const signedUrlCache = new Map<string, string | null>();
  const resolveFileUrl = async (fileId: string | undefined) => {
    if (!fileId) {
      return null;
    }
    const file = fileById.get(fileId);
    if (!file) {
      return null;
    }
    if (file.url) {
      return file.url;
    }
    if (!file.bucket_name || !file.storage_key) {
      return null;
    }

    const cacheKey = `${file.bucket_name}:${file.storage_key}`;
    if (signedUrlCache.has(cacheKey)) {
      return signedUrlCache.get(cacheKey) ?? null;
    }

    const { data, error } = await supabase.storage
      .from(file.bucket_name)
      .createSignedUrl(file.storage_key, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      signedUrlCache.set(cacheKey, null);
      return null;
    }
    signedUrlCache.set(cacheKey, data.signedUrl);
    return data.signedUrl;
  };

  const markers = await Promise.all(
    petRows
      .filter((pet) => pet.id_address !== null)
      .map(async (pet) => {
        const address = addressById.get(pet.id_address as string);
        if (!address) {
          return null;
        }

        const petFiles = filesByPet.get(pet.id);
        if (!petFiles || petFiles.length === 0) {
          return null;
        }

        const photos = (
          await Promise.all(
            petFiles.map(async (fileIdsByPet) => {
              const originalFile = fileById.get(fileIdsByPet.originalId);
              const miniFile = fileById.get(fileIdsByPet.miniId);
              if (!originalFile || !miniFile) {
                return null;
              }

              const [originalUrl, thumbnailUrl] = await Promise.all([
                resolveFileUrl(fileIdsByPet.originalId),
                resolveFileUrl(fileIdsByPet.miniId),
              ]);

              if (!thumbnailUrl) {
                return null;
              }

              return {
                originalUrl,
                thumbnailUrl,
              };
            }),
          )
        ).filter(
          (photo): photo is { originalUrl: string | null; thumbnailUrl: string } =>
            Boolean(photo),
        );

        if (photos.length === 0) {
          return null;
        }

        return {
          petLossId: pet.id,
          longitude: address.longitude,
          latitude: address.latitude,
          fullAddress: address.full_address,
          petName: pet.nombre_mascota,
          thumbnailUrl: photos[0].thumbnailUrl,
          photos,
        };
      }),
  );

  const filteredMarkers = markers.filter((marker): marker is NonNullable<typeof marker> =>
    Boolean(marker),
  );

  return Response.json({ markers: filteredMarkers });
}
