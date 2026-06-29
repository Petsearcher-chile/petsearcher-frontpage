import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  date_perdida: string | null;
};

type PetFoundRow = {
  id: number;
  id_address: string | null;
  supuesto_nombre: string | null;
  date_encontre: string | null;
};

type PetLossPhotoRow = {
  id_perdida: number;
  id_file: string | null;
  id_file_miniatura: string | null;
  id_file_nano: string | null;
};

type PetFoundPhotoRow = {
  id_encontre: number;
  id_file: string | null;
  id_file_miniatura: string | null;
  id_file_nano: string | null;
};

type FileRow = {
  id: string;
  storage_key: string | null;
  bucket_name: string | null;
  url: string | null;
  id_user: string | null;
};

type UserRow = {
  id: string;
  name: string | null;
  last_name: string | null;
  email: string;
};

type MarkerPhoto = {
  originalUrl: string | null;
  thumbnailUrl: string;
  nanoUrl: string;
};

type MarkerResponse = {
  markerType: "lost" | "found";
  markerId: number;
  longitude: number;
  latitude: number;
  fullAddress: string;
  petName: string | null;
  lostPetDate: string | null;
  creatorName: string | null;
  creatorEmail: string | null;
  thumbnailUrl: string | null;
  photos: MarkerPhoto[];
};

const formatUserName = (user: UserRow | undefined) => {
  if (!user) {
    return null;
  }

  const fullName = `${user.name ?? ""} ${user.last_name ?? ""}`.trim();
  return fullName.length > 0 ? fullName : null;
};

const resolveCreatorInfo = (
  petFiles: { originalId: string }[],
  fileById: Map<string, FileRow>,
  userById: Map<string, UserRow>,
) => {
  const creatorUserId = petFiles
    .map((fileIdsByPet) => fileById.get(fileIdsByPet.originalId)?.id_user)
    .find((userId): userId is string => Boolean(userId));

  const creator = creatorUserId ? userById.get(creatorUserId) : undefined;
  return {
    creatorName: formatUserName(creator),
    creatorEmail: creator?.email ?? null,
  };
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
    return Response.json({ message: "Parámetros de límites inválidos." }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: addresses, error: addressesError } = await supabase
    .from("mapbox_addresses")
    .select("id, longitude, latitude, full_address")
    .gt("longitude", minLongitude)
    .lt("longitude", maxLongitude)
    .gt("latitude", minLatitude)
    .lt("latitude", maxLatitude)
    .limit(500);

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

  const [petLossesResult, petFoundResult] = await Promise.all([
    supabase
      .from("pet_perdida")
      .select("id, id_address, nombre_mascota, date_perdida")
      .eq("estado", "registrada")
      .in("id_address", addressIds)
      .limit(300),
    supabase
      .from("pet_encontre")
      .select("id, id_address, supuesto_nombre, date_encontre")
      .eq("estado", "encontrada")
      .in("id_address", addressIds)
      .limit(300),
  ]);

  if (petLossesResult.error) {
    return Response.json(
      { message: "No se pudieron consultar pérdidas.", detail: petLossesResult.error.message },
      { status: 500 },
    );
  }

  if (petFoundResult.error) {
    return Response.json(
      { message: "No se pudieron consultar hallazgos.", detail: petFoundResult.error.message },
      { status: 500 },
    );
  }

  const petLossRows = (petLossesResult.data ?? []) as PetLossRow[];
  const petFoundRows = (petFoundResult.data ?? []) as PetFoundRow[];

  if (petLossRows.length === 0 && petFoundRows.length === 0) {
    return Response.json({ markers: [] });
  }

  const petLossIds = petLossRows.map((pet) => pet.id);
  const petFoundIds = petFoundRows.map((pet) => pet.id);

  const [petLossPhotosResult, petFoundPhotosResult] = await Promise.all([
    petLossIds.length > 0
      ? supabase
          .from("pet_perdida_fotos")
          .select("id_perdida, id_file, id_file_miniatura, id_file_nano")
          .in("id_perdida", petLossIds)
      : Promise.resolve({ data: [], error: null }),
    petFoundIds.length > 0
      ? supabase
          .from("pet_encontre_fotos")
          .select("id_encontre, id_file, id_file_miniatura, id_file_nano")
          .in("id_encontre", petFoundIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (petLossPhotosResult.error) {
    return Response.json(
      { message: "No se pudieron consultar fotos de pérdidas.", detail: petLossPhotosResult.error.message },
      { status: 500 },
    );
  }

  if (petFoundPhotosResult.error) {
    return Response.json(
      { message: "No se pudieron consultar fotos de hallazgos.", detail: petFoundPhotosResult.error.message },
      { status: 500 },
    );
  }

  const lossPhotoRows = (petLossPhotosResult.data ?? []) as PetLossPhotoRow[];
  const foundPhotoRows = (petFoundPhotosResult.data ?? []) as PetFoundPhotoRow[];

  const lossFilesByPet = new Map<number, { originalId: string; miniId: string; nanoId?: string }[]>();
  for (const row of lossPhotoRows) {
    if (!row.id_file || !row.id_file_miniatura) {
      continue;
    }
    const current = lossFilesByPet.get(row.id_perdida) ?? [];
    current.push({
      originalId: row.id_file,
      miniId: row.id_file_miniatura,
      nanoId: row.id_file_nano ?? undefined,
    });
    lossFilesByPet.set(row.id_perdida, current);
  }

  const foundFilesByPet = new Map<number, { originalId: string; miniId: string; nanoId: string }[]>();
  for (const row of foundPhotoRows) {
    if (!row.id_file || !row.id_file_miniatura || !row.id_file_nano) {
      continue;
    }
    const current = foundFilesByPet.get(row.id_encontre) ?? [];
    current.push({
      originalId: row.id_file,
      miniId: row.id_file_miniatura,
      nanoId: row.id_file_nano,
    });
    foundFilesByPet.set(row.id_encontre, current);
  }

  const fileIds = Array.from(
    new Set(
      [
        ...Array.from(lossFilesByPet.values()).flatMap((entries) =>
          entries.flatMap((entry) => [entry.originalId, entry.miniId, entry.nanoId].filter(Boolean) as string[]),
        ),
        ...Array.from(foundFilesByPet.values()).flatMap((entries) =>
          entries.flatMap((entry) => [entry.originalId, entry.miniId, entry.nanoId]),
        ),
      ].flat(),
    ),
  );

  let fileById = new Map<string, FileRow>();
  if (fileIds.length > 0) {
    const { data: files, error: filesError } = await supabase
      .from("files")
      .select("id, storage_key, bucket_name, url, id_user")
      .in("id", fileIds);

    if (filesError) {
      return Response.json(
        { message: "No se pudieron consultar archivos.", detail: filesError.message },
        { status: 500 },
      );
    }

    fileById = new Map(((files ?? []) as FileRow[]).map((file) => [file.id, file]));
  }

  const userIds = Array.from(
    new Set(
      Array.from(fileById.values())
        .map((file) => file.id_user)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );

  let userById = new Map<string, UserRow>();
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from("user")
      .select("id, name, last_name, email")
      .in("id", userIds);

    if (usersError) {
      return Response.json(
        { message: "No se pudieron consultar usuarios.", detail: usersError.message },
        { status: 500 },
      );
    }

    userById = new Map(((users ?? []) as UserRow[]).map((user) => [user.id, user]));
  }

  const signedUrlCache = new Map<string, string | null>();

  const resolveStorageKeyUrl = async (bucketName: string | null, storageKey: string | null) => {
    if (!bucketName || !storageKey) {
      return null;
    }

    const cacheKey = `${bucketName}:${storageKey}`;
    if (signedUrlCache.has(cacheKey)) {
      return signedUrlCache.get(cacheKey) ?? null;
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      signedUrlCache.set(cacheKey, null);
      return null;
    }

    signedUrlCache.set(cacheKey, data.signedUrl);
    return data.signedUrl;
  };

  const resolveFileUrl = async (fileId: string | undefined) => {
    if (!fileId) {
      return null;
    }

    const file = fileById.get(fileId);
    if (!file) {
      return null;
    }

    if (!file.bucket_name || !file.storage_key) {
      return file.url;
    }

    return resolveStorageKeyUrl(file.bucket_name, file.storage_key);
  };

  const lossMarkers = await Promise.all(
    petLossRows
      .filter((pet) => pet.id_address !== null)
      .map(async (pet) => {
        const address = addressById.get(pet.id_address as string);
        if (!address) {
          return null;
        }

        const petFiles = lossFilesByPet.get(pet.id);
        if (!petFiles || petFiles.length === 0) {
          return null;
        }

        const photos = (
          await Promise.all(
            petFiles.map(async (fileIdsByPet) => {
              const miniFile = fileById.get(fileIdsByPet.miniId);
              const [originalUrl, thumbnailUrl] = await Promise.all([
                resolveFileUrl(fileIdsByPet.originalId),
                resolveFileUrl(fileIdsByPet.miniId),
              ]);
              const directNanoUrl = await resolveFileUrl(fileIdsByPet.nanoId);
              const fallbackNanoUrl = await resolveStorageKeyUrl(
                miniFile?.bucket_name ?? null,
                miniFile?.storage_key?.replace(/^miniatura\//, "nano/") ?? null,
              );
              const nanoUrl = directNanoUrl ?? fallbackNanoUrl;

              if (!thumbnailUrl || !nanoUrl) {
                return null;
              }

              return {
                originalUrl,
                thumbnailUrl,
                nanoUrl,
              };
            }),
          )
        ).filter((photo): photo is MarkerPhoto => Boolean(photo));

        if (photos.length === 0) {
          return null;
        }

        const creatorInfo = resolveCreatorInfo(petFiles, fileById, userById);

        const marker: MarkerResponse = {
          markerType: "lost",
          markerId: pet.id,
          longitude: address.longitude,
          latitude: address.latitude,
          fullAddress: address.full_address,
          petName: pet.nombre_mascota,
          lostPetDate: pet.date_perdida,
          creatorName: creatorInfo.creatorName,
          creatorEmail: creatorInfo.creatorEmail,
          thumbnailUrl: photos[0].nanoUrl,
          photos,
        };

        return marker;
      }),
  );

  const foundMarkers = await Promise.all(
    petFoundRows
      .filter((pet) => pet.id_address !== null)
      .map(async (pet) => {
        const address = addressById.get(pet.id_address as string);
        if (!address) {
          return null;
        }

        const petFiles = foundFilesByPet.get(pet.id);
        if (!petFiles || petFiles.length === 0) {
          return null;
        }

        const photos = (
          await Promise.all(
            petFiles.map(async (fileIdsByPet) => {
              const [originalUrl, thumbnailUrl, nanoUrl] = await Promise.all([
                resolveFileUrl(fileIdsByPet.originalId),
                resolveFileUrl(fileIdsByPet.miniId),
                resolveFileUrl(fileIdsByPet.nanoId),
              ]);

              if (!thumbnailUrl || !nanoUrl) {
                return null;
              }

              return {
                originalUrl,
                thumbnailUrl,
                nanoUrl,
              };
            }),
          )
        ).filter((photo): photo is MarkerPhoto => Boolean(photo));

        if (photos.length === 0) {
          return null;
        }

        const creatorInfo = resolveCreatorInfo(petFiles, fileById, userById);

        const marker: MarkerResponse = {
          markerType: "found",
          markerId: pet.id,
          longitude: address.longitude,
          latitude: address.latitude,
          fullAddress: address.full_address,
          petName: pet.supuesto_nombre,
          lostPetDate: pet.date_encontre,
          creatorName: creatorInfo.creatorName,
          creatorEmail: creatorInfo.creatorEmail,
          thumbnailUrl: photos[0].nanoUrl,
          photos,
        };

        return marker;
      }),
  );

  const markers = [...lossMarkers, ...foundMarkers].filter(
    (marker): marker is NonNullable<typeof marker> => Boolean(marker),
  );

  return Response.json(
    { markers },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
