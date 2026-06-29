import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { Jimp, JimpMime } from "jimp";
import { getApiTranslator } from "@/i18n/api-messages";
import { validatePetPhoto } from "../_lib/photo-validation";

const SUPABASE_URL =
  process.env.SUPABASE_URL;
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
const LOST_PET_NAME_PATTERN = /^(?!.*[ _\-°ñÑ]{2})[a-zA-Z0-9°_\-ñÑ ]+$/;

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
    const tApi = await getApiTranslator();
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        { message: tApi("faltan_variables_de_entorno_de_supabase") },
        { status: 500 },
      );
    }

    if (
      !process.env.AWS_REGION ||
      !process.env.AWS_ACCESS_KEY_ID ||
      !process.env.AWS_SECRET_ACCESS_KEY
    ) {
      return Response.json(
        { message: tApi("faltan_variables_de_entorno_de_aws") },
        { status: 500 },
      );
    }

    if (!isValidHttpUrl(SUPABASE_URL)) {
      return Response.json(
        { message: tApi("la_url_de_supabase_no_es_valida") },
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
    if (lostPetName !== null && !LOST_PET_NAME_PATTERN.test(lostPetName)) {
      return Response.json(
        {
          message: tApi(
            "nombre_invalido_no_puede_tener_dos_espacios_ni_caracteres_especiales_juntos",
          ),
        },
        { status: 400 },
      );
    }
    const uploadedFiles = formData.getAll("photos").filter(
      (entry): entry is File => entry instanceof File,
    );

    if (uploadedFiles.length === 0) {
      return Response.json({ message: tApi("no_se_enviaron_fotos") }, { status: 400 });
    }

    if (uploadedFiles.length > 10) {
      return Response.json({ message: tApi("puedes_subir_hasta_10_fotos") }, { status: 400 });
    }

    const hasNonImage = uploadedFiles.some(
      (file) => !ALLOWED_IMAGE_MIME_TYPES.has(file.type.toLowerCase()),
    );
    if (hasNonImage) {
      return Response.json(
        { message: tApi("solo_se_permiten_archivos_png_jpg_bmp_o_gif") },
        { status: 400 },
      );
    }

    const preparedFiles: { file: File; bytes: Buffer }[] = [];
    for (const file of uploadedFiles) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const validation = await validatePetPhoto(bytes);
      if (!validation.ok) {
        if (validation.reason === "not-pet") {
          return Response.json(
            { message: tApi("la_imagen_no_parece_mostrar_una_mascota") },
            { status: 400 },
          );
        }

        return Response.json({ message: tApi("error_inesperado_al_subir_fotos") }, { status: 500 });
      }

      preparedFiles.push({ file, bytes });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: bucket, error: bucketError } = await supabase.storage.getBucket(
      BUCKET_NAME,
    );
    if (bucketError || !bucket) {
      return Response.json(
        {
          message: tApi("no_se_pudo_acceder_al_bucket_bucket_name", { bucketName: BUCKET_NAME }),
          detail: bucketError?.message ?? tApi("bucket_no_encontrado"),
        },
        { status: 500 },
      );
    }

    const uploadedImages = await Promise.all(
      preparedFiles.map(async ({ file, bytes }) => {
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

        const sourceImage = await Jimp.read(bytes);
        sourceImage.rotate(0);
        const metadata = {
          width: sourceImage.bitmap.width,
          height: sourceImage.bitmap.height,
          format: file.type.split("/")[1] ?? "jpeg",
          hasAlpha: sourceImage.hasAlpha(),
        };
        console.log("thumbnail source metadata", {
          name: file.name,
          type: file.type,
          format: metadata.format,
          width: metadata.width,
          height: metadata.height,
          hasAlpha: metadata.hasAlpha,
        });
        const shouldPreserveAlpha = Boolean(metadata.hasAlpha) || metadata.format === "png";
        const outputMimeType = shouldPreserveAlpha ? "image/png" : "image/jpeg";
        const thumbnailPath = `${THUMBNAILS_FOLDER}/${baseName}.${shouldPreserveAlpha ? "png" : "jpg"}`;
        const thumbnailImage = sourceImage.clone();
        thumbnailImage.scaleToFit({ w: 320, h: 320 });
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
          console.error("thumbnail upload failed", {
            name: file.name,
            type: file.type,
            format: metadata.format,
            error: thumbnailError,
          });
          await supabase.storage.from(BUCKET_NAME).remove([originalPath]);
          return {
            ok: false,
            name: file.name,
            message: thumbnailError.message,
          };
        }

        const { error: nanoError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(nanoPath, nanoBuffer, {
            contentType: outputMimeType,
            upsert: false,
          });

        if (nanoError) {
          console.error("nano upload failed", {
            name: file.name,
            type: file.type,
            format: metadata.format,
            error: nanoError,
          });
          await supabase.storage.from(BUCKET_NAME).remove([originalPath, thumbnailPath]);
          return {
            ok: false,
            name: file.name,
            message: nanoError.message,
          };
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
          message: tApi("error_inesperado_al_subir_fotos"),
          detail: tApi("error_de_subida"),
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
      return Response.json(
        { message: tApi("debes_iniciar_sesion_para_subir_fotos") },
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
        { message: tApi("no_se_pudo_obtener_el_email_del_usuario_logeado") },
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
        { message: tApi("no_se_pudo_consultar_el_usuario"), detail: existingUserError.message },
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
          { message: tApi("no_se_pudo_crear_el_usuario"), detail: createUserError.message },
          { status: 500 },
        );
      }
      appUserId = createdUser.id as string;
    }

    let petLossId: number;
    let wasPetLossCreated = false;

    if (petLossIdFromRequest !== null) {
      const updatePayload: {
        nombre_mascota?: string | null;
        date_perdida?: string | null;
        estado: "en_proceso";
      } = {
        estado: "en_proceso",
      };
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
              message: tApi("no_se_pudo_actualizar_la_perdida"),
              detail: updatePetLossError?.message ?? tApi("registro_no_encontrado"),
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
              message: tApi("no_se_encontro_la_perdida_para_asociar_fotos"),
              detail: existingPetLossError?.message ?? tApi("registro_no_encontrado"),
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
          estado: "en_proceso",
        })
        .select("id")
        .single();
      if (createPetLossError) {
        await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
        return Response.json(
          { message: tApi("no_se_pudo_crear_la_perdida"), detail: createPetLossError.message },
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
      if (wasPetLossCreated) {
        await supabase.from("pet_perdida").delete().eq("id", petLossId);
      }
      return Response.json(
        {
          message: tApi("no_se_pudo_registrar_la_metadata_de_archivos"),
          detail: createFilesError?.message ?? tApi("insert_vacio_en_files"),
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
      const nanoFileId = fileIdByStorageKey.get(file.nanoPath);

      if (!originalFileId || !thumbnailFileId || !nanoFileId) {
        throw new Error("No se pudieron resolver los IDs de archivos creados.");
      }

      return {
        id_perdida: petLossId,
        id_file: originalFileId,
        id_file_miniatura: thumbnailFileId,
        id_file_nano: nanoFileId,
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
          message: tApi("no_se_pudo_vincular_la_perdida_con_sus_fotos"),
          detail: createPetPhotosError.message,
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
      (item): item is {
        id: string;
        thumbnailUrl: string;
        originalUrl: string;
        name: string;
      } => Boolean(item),
    );

    return Response.json({
      ok: true,
      count: uploadedFiles.length,
      petLossId,
      files: successfulUploads,
      previewImages,
    });
  } catch (error: unknown) {
    const tApi = await getApiTranslator();
    return Response.json(
      {
        message: tApi("error_inesperado_al_subir_fotos"),
        detail: error instanceof Error ? error.message : "Error desconocido.",
      },
      { status: 500 },
    );
  }
}
