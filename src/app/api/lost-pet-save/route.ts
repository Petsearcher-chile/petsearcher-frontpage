import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOST_PET_NAME_PATTERN = /^(?!.*[ _\-°ñÑ]{2})[a-zA-Z0-9°_\-ñÑ ]+$/;

type SelectedAddressDetail = {
  fullAddress: string;
  longitude: number;
  latitude: number;
  country: string | null;
  region: string | null;
  city: string | null;
  postcode: string | null;
  street: string | null;
  houseNumber: string | null;
};

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const asNullableText = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const parseSelectedAddress = (value: unknown): SelectedAddressDetail | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const input = value as Record<string, unknown>;
  const fullAddress = asNullableText(input.fullAddress);
  const longitude =
    typeof input.longitude === "number" && Number.isFinite(input.longitude)
      ? input.longitude
      : null;
  const latitude =
    typeof input.latitude === "number" && Number.isFinite(input.latitude)
      ? input.latitude
      : null;

  if (fullAddress === null || longitude === null || latitude === null) {
    return null;
  }

  return {
    fullAddress,
    longitude,
    latitude,
    country: asNullableText(input.country),
    region: asNullableText(input.region),
    city: asNullableText(input.city),
    postcode: asNullableText(input.postcode),
    street: asNullableText(input.street),
    houseNumber: asNullableText(input.houseNumber),
  };
};

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      { message: "Faltan variables de entorno de Supabase." },
      { status: 500 },
    );
  }

  if (!isValidHttpUrl(SUPABASE_URL)) {
    return Response.json(
      { message: "La URL de Supabase no es válida." },
      { status: 500 },
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { message: "Debes iniciar sesión para guardar." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    petLossId?: unknown;
    lostPetDate?: unknown;
    lostPetName?: unknown;
    mapboxAddress?: unknown;
  };
  const petLossId =
    typeof body.petLossId === "number" && Number.isInteger(body.petLossId)
      ? body.petLossId
      : null;
  const lostPetDate =
    typeof body.lostPetDate === "string" && body.lostPetDate.trim().length > 0
      ? `${body.lostPetDate.trim()}T00:00:00`
      : null;
  const lostPetName =
    typeof body.lostPetName === "string" && body.lostPetName.trim().length > 0
      ? body.lostPetName.trim().slice(0, 30)
      : null;
  const mapboxAddress = parseSelectedAddress(body.mapboxAddress);

  if (petLossId === null) {
    return Response.json(
      { message: "No se pudo identificar la pérdida para guardar." },
      { status: 400 },
    );
  }

  if (lostPetDate === null || lostPetName === null) {
    return Response.json(
      { message: "Debes ingresar fecha y nombre para guardar." },
      { status: 400 },
    );
  }

  if (!LOST_PET_NAME_PATTERN.test(lostPetName)) {
    return Response.json(
      {
        message:
          "Nombre inválido. No puede tener dos espacios ni caracteres especiales juntos.",
      },
      { status: 400 },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (!mapboxAddress) {
    return Response.json(
      {
        message:
          "Debe seleccionar un lugar donde se perdió su mascota, arriba en el buscador, busque su dirección",
      },
      { status: 400 },
    );
  }

  const { data: createdAddress, error: addressError } = await supabase
    .from("mapbox_addresses")
    .insert({
      full_address: mapboxAddress.fullAddress,
      longitude: mapboxAddress.longitude,
      latitude: mapboxAddress.latitude,
      country: mapboxAddress.country,
      region: mapboxAddress.region,
      city: mapboxAddress.city,
      postcode: mapboxAddress.postcode,
      street: mapboxAddress.street,
      house_number: mapboxAddress.houseNumber,
    })
    .select("id")
    .single();

  if (addressError || !createdAddress) {
    return Response.json(
      {
        message: "No se pudo guardar la dirección seleccionada.",
        detail: addressError?.message ?? "No se creó el registro de dirección.",
      },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("pet_perdida")
    .update({
      estado: "registrada",
      date_perdida: lostPetDate,
      nombre_mascota: lostPetName,
      id_address: createdAddress.id,
    })
    .eq("id", petLossId)
    .select("id")
    .single();

  if (error || !data) {
    return Response.json(
      {
        message: "No se pudo guardar la pérdida.",
        detail: error?.message ?? "Registro no encontrado.",
      },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, petLossId: data.id });
}
