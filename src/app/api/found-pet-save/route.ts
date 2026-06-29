import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getApiTranslator } from "@/i18n/api-messages";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FOUND_PET_NAME_PATTERN = /^(?!.*[ _\-°ñÑ]{2})[a-zA-Z0-9°_\-ñÑ ]+$/;

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
  const tApi = await getApiTranslator();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ message: tApi("faltan_variables_de_entorno_de_supabase") }, { status: 500 });
  }

  if (!isValidHttpUrl(SUPABASE_URL)) {
    return Response.json({ message: tApi("la_url_de_supabase_no_es_valida") }, { status: 500 });
  }

  const { userId } = await auth();
  if (!userId) {
    return Response.json({ message: tApi("debes_iniciar_sesion_para_guardar") }, { status: 401 });
  }

  const body = (await request.json()) as {
    petFoundId?: unknown;
    foundPetDate?: unknown;
    foundPetName?: unknown;
    mapboxAddress?: unknown;
  };
  const petFoundId =
    typeof body.petFoundId === "number" && Number.isInteger(body.petFoundId)
      ? body.petFoundId
      : null;
  const foundPetDate =
    typeof body.foundPetDate === "string" && body.foundPetDate.trim().length > 0
      ? `${body.foundPetDate.trim()}T00:00:00`
      : null;
  const foundPetName =
    typeof body.foundPetName === "string" && body.foundPetName.trim().length > 0
      ? body.foundPetName.trim().slice(0, 30)
      : null;
  const mapboxAddress = parseSelectedAddress(body.mapboxAddress);

  if (petFoundId === null) {
    return Response.json(
      { message: tApi("no_se_pudo_identificar_el_hallazgo_para_guardar") },
      { status: 400 },
    );
  }

  if (foundPetDate === null) {
    return Response.json({ message: tApi("debes_ingresar_fecha_para_guardar") }, { status: 400 });
  }

  if (foundPetName !== null && !FOUND_PET_NAME_PATTERN.test(foundPetName)) {
    return Response.json(
      {
        message: tApi(
          "nombre_invalido_no_puede_tener_dos_espacios_ni_caracteres_especiales_juntos",
        ),
      },
      { status: 400 },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (!mapboxAddress) {
    return Response.json(
      {
        message: tApi(
          "debe_seleccionar_un_lugar_donde_encontro_la_mascota_arriba_en_el_buscador_busque_su_direccion",
        ),
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
        message: tApi("no_se_pudo_guardar_la_direccion_seleccionada"),
        detail: addressError?.message ?? tApi("no_se_creo_el_registro_de_direccion"),
      },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("pet_encontre")
    .update({
      estado: "encontrada",
      date_encontre: foundPetDate,
      supuesto_nombre: foundPetName,
      id_address: createdAddress.id,
    })
    .eq("id", petFoundId)
    .select("id")
    .single();

  if (error || !data) {
    return Response.json(
      {
        message: tApi("no_se_pudo_guardar_el_hallazgo"),
        detail: error?.message ?? tApi("registro_no_encontrado"),
      },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, petFoundId: data.id });
}
