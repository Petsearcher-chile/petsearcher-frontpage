import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = "fotos_perdidos";
const ORIGINALS_FOLDER = "originales";
const THUMBNAILS_FOLDER = "miniatura";

export const runtime = "nodejs";

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export async function POST(request: Request) {
  try {
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
    const { data: bucket, error: bucketError } = await supabase.storage.getBucket(
      BUCKET_NAME,
    );
    if (bucketError || !bucket) {
      return Response.json(
        {
          message: `No se pudo acceder al bucket "${BUCKET_NAME}".`,
          detail: bucketError?.message ?? "Bucket no encontrado.",
        },
        { status: 500 },
      );
    }

    const files = await Promise.all(
      uploadedFiles.map(async (file) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const extension =
          file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ??
          "jpg";
        const baseName = `${Date.now()}-${crypto.randomUUID()}`;
        const originalPath = `${ORIGINALS_FOLDER}/${baseName}.${extension}`;
        const { error: originalError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(originalPath, bytes, {
            contentType: file.type,
            upsert: false,
          });

        if (originalError) {
          return {
            ok: false,
            name: file.name,
            message: originalError.message,
          };
        }

        const thumbnailBuffer = await sharp(bytes)
          .rotate()
          .resize(200, 200, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        const thumbnailPath = `${THUMBNAILS_FOLDER}/${baseName}.jpg`;
        const { error: thumbnailError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(thumbnailPath, thumbnailBuffer, {
            contentType: "image/jpeg",
            upsert: false,
          });

        if (thumbnailError) {
          await supabase.storage.from(BUCKET_NAME).remove([originalPath]);
          return {
            ok: false,
            name: file.name,
            message: thumbnailError.message,
          };
        }

        return {
          ok: true,
          name: file.name,
          originalPath,
          thumbnailPath,
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
          detail: failedFiles[0]?.message ?? "Error de subida.",
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
  } catch (error: unknown) {
    return Response.json(
      {
        message: "Error inesperado al subir fotos.",
        detail: error instanceof Error ? error.message : "Error desconocido.",
      },
      { status: 500 },
    );
  }
}
