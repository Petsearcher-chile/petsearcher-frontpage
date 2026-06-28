import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = "fotos_perdidos";

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      { message: "Faltan variables de entorno de Supabase." },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const uploadedFiles = formData.getAll("photos").filter(
    (entry): entry is File => entry instanceof File,
  );

  if (uploadedFiles.length === 0) {
    return Response.json({ message: "No se enviaron fotos." }, { status: 400 });
  }

  if (uploadedFiles.length > 10) {
    return Response.json(
      { message: "Puedes subir hasta 10 fotos." },
      { status: 400 },
    );
  }

  const hasNonImage = uploadedFiles.some((file) => !file.type.startsWith("image/"));
  if (hasNonImage) {
    return Response.json(
      { message: "Solo se permiten archivos de imagen." },
      { status: 400 },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const files = await Promise.all(
    uploadedFiles.map(async (file) => {
      const extension =
        file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ??
        "jpg";
      const filePath = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        return {
          ok: false,
          name: file.name,
          message: error.message,
        };
      }

      return {
        ok: true,
        name: file.name,
        path: filePath,
        size: file.size,
        type: file.type,
      };
    }),
  );

  const failedFiles = files.filter((file) => !file.ok);
  if (failedFiles.length > 0) {
    return Response.json(
      {
        message: "No se pudieron subir todas las fotos.",
        failedFiles,
      },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    count: uploadedFiles.length,
    files,
  });
}
