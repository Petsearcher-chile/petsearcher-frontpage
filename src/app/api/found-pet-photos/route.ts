import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { Jimp, JimpMime } from "jimp";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = "fotos_perdidos";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const ORIGINALS_FOLDER = "originales";
const THUMBNAILS_FOLDER = "miniatura";
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/bmp",
  "image/gif",
]);
const FOUND_PET_NAME_PATTERN = /^(?!.*[ _\-°ñÑ]{2})[a-zA-Z0-9°_\-ñÑ ]+$/;

export const runtime = "nodejs";

type UploadedImage = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailSizeBytes: number;
  nanoSizeBytes: number;
  originalPath: string;
  thumbnailPath: string;
  nanoPath: string;
  outputMimeType: string;
};

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
      return Response.json({ message: "Faltan variables de entorno de Supabase." }, { status: 500 });
    }

    if (!isValidHttpUrl(SUPABASE_URL)) {
      return Response.json({ message: "La URL de Supabase no es válida." }, { status: 500 });
    }

    const formData = await request.formData();
    const rawPetFoundId = formData.get("petFoundId");
    const rawFoundPetDate = formData.get("foundPetDate");
    const rawFoundPetName = formData.get("foundPetName");
    const petFoundIdFromRequest =
      typeof rawPetFoundId === "string" && /^[0-9]+$/.test(rawPetFoundId.trim())
        ? Number(rawPetFoundId.trim())
        : null;
    const foundPetDate =
      typeof rawFoundPetDate === "string" && rawFoundPetDate.trim().length > 0
        ? `${rawFoundPetDate.trim()}T00:00:00`
        : null;
    const foundPetName =
      typeof rawFoundPetName === "string" && rawFoundPetName.trim().length > 0
        ? rawFoundPetName.trim().slice(0, 30)
        : null;
    if (foundPetName !== null && !FOUND_PET_NAME_PATTERN.test(foundPetName)) {
      return Response.json(
        {
          message:
            "Nombre inválido. No puede tener dos espacios ni caracteres especiales juntos.",
        },
        { status: 400 },
      );
    }

    const uploadedFiles = formData.getAll("photos").filter(
      (entry): entry is File => entry instanceof File,
    );
    if (uploadedFiles.length === 0) {
      return Response.json({ message: "No se enviaron fotos." }, { status: 400 });
    }
    if (uploadedFiles.length > 10) {
      return Response.json({ message: "Puedes subir hasta 10 fotos." }, { status: 400 });
    }

    const hasNonImage = uploadedFiles.some(
      (file) => !ALLOWED_IMAGE_MIME_TYPES.has(file.type.toLowerCase()),
    );
    if (hasNonImage) {
      return Response.json(
        { message: "Solo se permiten archivos PNG, JPG, BMP o GIF." },
        { status: 400 },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: bucket, error: bucketError } = await supabase.storage.getBucket(BUCKET_NAME);
    if (bucketError || !bucket) {
      return Response.json(
        {
          message: `No se pudo acceder al bucket "${BUCKET_NAME}".`,
          detail: bucketError?.message ?? "Bucket no encontrado.",
        },
        { status: 500 },
      );
    }

    const uploadedImages = await Promise.all(
      uploadedFiles.map(async (file) => {
        const bytes = Buffer.from(await file.arrayBuffer());
        const extension =
          file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "jpg";
        const baseName = `${Date.now()}-${crypto.randomUUID()}`;
        const originalPath = `${ORIGINALS_FOLDER}/${baseName}.${extension}`;

        const { error: originalError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(originalPath, bytes, {
            contentType: file.type,
            upsert: false,
          });
        if (originalError) {
          return { ok: false, name: file.name, message: originalError.message };
        }

        const sourceImage = await Jimp.read(bytes);
        sourceImage.rotate(0);
        const metadata = {
          format: file.type.split("/")[1] ?? "jpeg",
          hasAlpha: sourceImage.hasAlpha(),
        };
        const shouldPreserveAlpha = Boolean(metadata.hasAlpha) || metadata.format === "png";
        const outputMimeType = shouldPreserveAlpha ? "image/png" : "image/jpeg";
        const thumbnailPath = `${THUMBNAILS_FOLDER}/${baseName}.${shouldPreserveAlpha ? "png" : "jpg"}`;
        const thumbnailImage = sourceImage.clone();
        thumbnailImage.scaleToFit({ w: 200, h: 200 });
        const thumbnailBuffer = shouldPreserveAlpha
          ? await thumbnailImage.getBuffer(JimpMime.png)
          : await thumbnailImage.getBuffer(JimpMime.jpeg);
        const nanoImage = sourceImage.clone();
        nanoImage.scaleToFit({ w: 55, h: 55 });
        const nanoPath = `nano/${baseName}.${shouldPreserveAlpha ? "png" : "jpg"}`;
        const nanoBuffer = shouldPreserveAlpha
          ? await nanoImage.getBuffer(JimpMime.png)
          : await nanoImage.getBuffer(JimpMime.jpeg);

        const { error: thumbnailError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(thumbnailPath, thumbnailBuffer, {
            contentType: outputMimeType,
            upsert: false,
          });
        if (thumbnailError) {
          await supabase.storage.from(BUCKET_NAME).remove([originalPath]);
          return { ok: false, name: file.name, message: thumbnailError.message };
        }

        const { error: nanoError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(nanoPath, nanoBuffer, {
            contentType: outputMimeType,
            upsert: false,
          });
        if (nanoError) {
          await supabase.storage.from(BUCKET_NAME).remove([originalPath, thumbnailPath]);
          return { ok: false, name: file.name, message: nanoError.message };
        }

        return {
          ok: true as const,
          name: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          thumbnailSizeBytes: thumbnailBuffer.byteLength,
          nanoSizeBytes: nanoBuffer.byteLength,
          originalPath,
          thumbnailPath,
          nanoPath,
          outputMimeType,
        };
      }),
    );

    const failedFiles = uploadedImages.filter((file) => !file.ok);
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

    const successfulUploads = uploadedImages.filter(
      (file): file is UploadedImage & { ok: true } => file.ok,
    );
    const uploadedPaths = successfulUploads.flatMap((file) => [
      file.originalPath,
      file.thumbnailPath,
      file.nanoPath,
    ]);

    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
      return Response.json({ message: "Debes iniciar sesión para subir fotos." }, { status: 401 });
    }

    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(clerkUserId);
    const primaryEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;
    if (!primaryEmail) {
      await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
      return Response.json(
        { message: "No se pudo obtener el email del usuario logeado." },
        { status: 500 },
      );
    }

    const { data: existingUser, error: existingUserError } = await supabase
      .from("user")
      .select("id")
      .eq("email", primaryEmail)
      .maybeSingle();
    if (existingUserError) {
      await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
      return Response.json(
        { message: "No se pudo consultar el usuario.", detail: existingUserError.message },
        { status: 500 },
      );
    }

    let appUserId = existingUser?.id as string | undefined;
    if (!appUserId) {
      const generatedUserId = crypto.randomUUID();
      const { data: createdUser, error: createUserError } = await supabase
        .from("user")
        .insert({
          id: generatedUserId,
          name: clerkUser.firstName ?? null,
          last_name: clerkUser.lastName ?? null,
          email: primaryEmail,
        })
        .select("id")
        .single();
      if (createUserError) {
        await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
        return Response.json(
          { message: "No se pudo crear el usuario.", detail: createUserError.message },
          { status: 500 },
        );
      }
      appUserId = createdUser.id as string;
    }

    let petFoundId: number;
    let wasPetFoundCreated = false;

    if (petFoundIdFromRequest !== null) {
      const updatePayload: {
        supuesto_nombre?: string | null;
        date_encontre?: string | null;
        estado: "en_proceso";
      } = { estado: "en_proceso" };
      if (foundPetName !== null) {
        updatePayload.supuesto_nombre = foundPetName;
      }
      if (foundPetDate !== null) {
        updatePayload.date_encontre = foundPetDate;
      }

      const { data: updatedPetFound, error: updatePetFoundError } = await supabase
        .from("pet_encontre")
        .update(updatePayload)
        .eq("id", petFoundIdFromRequest)
        .select("id")
        .single();
      if (updatePetFoundError || !updatedPetFound) {
        await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
        return Response.json(
          {
            message: "No se pudo actualizar el hallazgo.",
            detail: updatePetFoundError?.message ?? "Registro no encontrado.",
          },
          { status: 500 },
        );
      }
      petFoundId = Number(updatedPetFound.id);
    } else {
      const { data: createdPetFound, error: createPetFoundError } = await supabase
        .from("pet_encontre")
        .insert({
          date_creacion: new Date().toISOString(),
          supuesto_nombre: foundPetName,
          date_encontre: foundPetDate,
          estado: "en_proceso",
        })
        .select("id")
        .single();
      if (createPetFoundError) {
        await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
        return Response.json(
          { message: "No se pudo crear el hallazgo.", detail: createPetFoundError.message },
          { status: 500 },
        );
      }

      petFoundId = Number(createdPetFound.id);
      wasPetFoundCreated = true;
    }

    const rowsForFiles = successfulUploads.flatMap((file) => [
      {
        name: file.name,
        storage_key: file.originalPath,
        bucket_name: BUCKET_NAME,
        mime_type: file.mimeType,
        size_bytes: file.sizeBytes,
        url: null,
        status: "active",
        id_user: appUserId,
      },
      {
        name: `${file.name} (miniatura)`,
        storage_key: file.thumbnailPath,
        bucket_name: BUCKET_NAME,
        mime_type: file.outputMimeType,
        size_bytes: file.thumbnailSizeBytes,
        url: null,
        status: "active",
        id_user: appUserId,
      },
      {
        name: `${file.name} (nano)`,
        storage_key: file.nanoPath,
        bucket_name: BUCKET_NAME,
        mime_type: file.outputMimeType,
        size_bytes: file.nanoSizeBytes,
        url: null,
        status: "active",
        id_user: appUserId,
      },
    ]);

    const { data: createdFileRows, error: createFilesError } = await supabase
      .from("files")
      .insert(rowsForFiles)
      .select("id, storage_key");
    if (createFilesError || !createdFileRows) {
      await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
      if (wasPetFoundCreated) {
        await supabase.from("pet_encontre").delete().eq("id", petFoundId);
      }
      return Response.json(
        {
          message: "No se pudo registrar la metadata de archivos.",
          detail: createFilesError?.message ?? "Insert vacío en files.",
        },
        { status: 500 },
      );
    }

    const fileIdByStorageKey = new Map<string, string>();
    createdFileRows.forEach((row) => {
      fileIdByStorageKey.set(row.storage_key as string, row.id as string);
    });

    const petFoundPhotoRows = successfulUploads.map((file) => {
      const originalFileId = fileIdByStorageKey.get(file.originalPath);
      const thumbnailFileId = fileIdByStorageKey.get(file.thumbnailPath);
      const nanoFileId = fileIdByStorageKey.get(file.nanoPath);

      if (!originalFileId || !thumbnailFileId || !nanoFileId) {
        throw new Error("No se pudieron resolver los IDs de archivos creados.");
      }

      return {
        id_encontre: petFoundId,
        id_file: originalFileId,
        id_file_miniatura: thumbnailFileId,
        id_file_nano: nanoFileId,
      };
    });

    const { error: createPetFoundPhotosError } = await supabase
      .from("pet_encontre_fotos")
      .insert(petFoundPhotoRows);
    if (createPetFoundPhotosError) {
      await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
      await supabase.from("files").delete().in("storage_key", uploadedPaths);
      if (wasPetFoundCreated) {
        await supabase.from("pet_encontre").delete().eq("id", petFoundId);
      }
      return Response.json(
        {
          message: "No se pudo vincular el hallazgo con sus fotos.",
          detail: createPetFoundPhotosError.message,
        },
        { status: 500 },
      );
    }

    const previewImages = (
      await Promise.all(
        successfulUploads.map(async (file) => {
          const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(file.thumbnailPath, SIGNED_URL_TTL_SECONDS);
          if (error || !data?.signedUrl) {
            return null;
          }
          const { data: originalData, error: originalError } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(file.originalPath, SIGNED_URL_TTL_SECONDS);
          if (originalError || !originalData?.signedUrl) {
            return null;
          }
          return {
            id: file.thumbnailPath,
            thumbnailUrl: data.signedUrl,
            originalUrl: originalData.signedUrl,
            name: file.name,
          };
        }),
      )
    ).filter(
      (
        item,
      ): item is { id: string; thumbnailUrl: string; originalUrl: string; name: string } =>
        Boolean(item),
    );

    return Response.json({
      ok: true,
      count: uploadedFiles.length,
      petFoundId,
      files: successfulUploads,
      previewImages,
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
