import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = "fotos_perdidos";
const ORIGINALS_FOLDER = "originales";
const THUMBNAILS_FOLDER = "miniatura";

export const runtime = "nodejs";

type UploadedImage = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailSizeBytes: number;
  originalPath: string;
  thumbnailPath: string;
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
    const rawPetLossId = formData.get("petLossId");
    const rawLostPetDate = formData.get("lostPetDate");
    const rawLostPetName = formData.get("lostPetName");
    const petLossIdFromRequest =
      typeof rawPetLossId === "string" && /^[0-9]+$/.test(rawPetLossId.trim())
        ? Number(rawPetLossId.trim())
        : null;
    const lostPetDate =
      typeof rawLostPetDate === "string" && rawLostPetDate.trim().length > 0
        ? `${rawLostPetDate.trim()}T00:00:00`
        : null;
    const lostPetName =
      typeof rawLostPetName === "string" && rawLostPetName.trim().length > 0
        ? rawLostPetName.trim().slice(0, 30)
        : null;
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

    const uploadedImages = await Promise.all(
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
          ok: true as const,
          name: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          thumbnailSizeBytes: thumbnailBuffer.byteLength,
          originalPath,
          thumbnailPath,
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
    ]);

    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
      return Response.json(
        { message: "Debes iniciar sesión para subir fotos." },
        { status: 401 },
      );
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

    let petLossId: number;
    let wasPetLossCreated = false;

    if (petLossIdFromRequest !== null) {
      const updatePayload: { nombre_mascota?: string | null; date_perdida?: string | null } = {};
      if (lostPetName !== null) {
        updatePayload.nombre_mascota = lostPetName;
      }
      if (lostPetDate !== null) {
        updatePayload.date_perdida = lostPetDate;
      }

      if (Object.keys(updatePayload).length > 0) {
        const { data: updatedPetLoss, error: updatePetLossError } = await supabase
          .from("pet_perdida")
          .update(updatePayload)
          .eq("id", petLossIdFromRequest)
          .select("id")
          .single();
        if (updatePetLossError || !updatedPetLoss) {
          await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
          return Response.json(
            {
              message: "No se pudo actualizar la pérdida.",
              detail: updatePetLossError?.message ?? "Registro no encontrado.",
            },
            { status: 500 },
          );
        }
        petLossId = Number(updatedPetLoss.id);
      } else {
        const { data: existingPetLoss, error: existingPetLossError } = await supabase
          .from("pet_perdida")
          .select("id")
          .eq("id", petLossIdFromRequest)
          .single();
        if (existingPetLossError || !existingPetLoss) {
          await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
          return Response.json(
            {
              message: "No se encontró la pérdida para asociar fotos.",
              detail: existingPetLossError?.message ?? "Registro no encontrado.",
            },
            { status: 500 },
          );
        }
        petLossId = Number(existingPetLoss.id);
      }
    } else {
      const { data: createdPetLoss, error: createPetLossError } = await supabase
        .from("pet_perdida")
        .insert({
          date_creacion: new Date().toISOString(),
          nombre_mascota: lostPetName,
          date_perdida: lostPetDate,
        })
        .select("id")
        .single();
      if (createPetLossError) {
        await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
        return Response.json(
          { message: "No se pudo crear la pérdida.", detail: createPetLossError.message },
          { status: 500 },
        );
      }

      petLossId = Number(createdPetLoss.id);
      wasPetLossCreated = true;
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
        mime_type: "image/jpeg",
        size_bytes: file.thumbnailSizeBytes,
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
      if (wasPetLossCreated) {
        await supabase.from("pet_perdida").delete().eq("id", petLossId);
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

    const petPhotoRows = successfulUploads.map((file) => {
      const originalFileId = fileIdByStorageKey.get(file.originalPath);
      const thumbnailFileId = fileIdByStorageKey.get(file.thumbnailPath);

      if (!originalFileId || !thumbnailFileId) {
        throw new Error("No se pudieron resolver los IDs de archivos creados.");
      }

      return {
        id_perdida: petLossId,
        id_file: originalFileId,
        id_file_miniatura: thumbnailFileId,
      };
    });

    const { error: createPetPhotosError } = await supabase
      .from("pet_perdida_fotos")
      .insert(petPhotoRows);
    if (createPetPhotosError) {
      await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
      await supabase.from("files").delete().in(
        "storage_key",
        uploadedPaths,
      );
      if (wasPetLossCreated) {
        await supabase.from("pet_perdida").delete().eq("id", petLossId);
      }
      return Response.json(
        {
          message: "No se pudo vincular la pérdida con sus fotos.",
          detail: createPetPhotosError.message,
        },
        { status: 500 },
      );
    }

    return Response.json({
      ok: true,
      count: uploadedFiles.length,
      petLossId,
      files: successfulUploads,
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
