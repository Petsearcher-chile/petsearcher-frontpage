"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import MapView from "@/components/MapView";
import type { RegisteredPetMarker } from "@/components/MapView";

type SelectedPoint = {
  longitude: number;
  latitude: number;
};

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

type PreviewImage = {
  id: string;
  thumbnailUrl: string;
  originalUrl: string;
  name: string;
};

type PopupState =
  | {
      type: "error" | "success";
      message: string;
    }
  | null;

type ApiResponse = {
  message?: string;
  detail?: string;
  petLossId?: number;
  petFoundId?: number;
  previewImages?: unknown;
};

type SheetMode = "menu" | "lost" | "found" | "detail";

const LOST_PET_NAME_MAX_LENGTH = 30;
const MAX_PHOTOS = 10;
const MAX_IMAGE_DIMENSION = 2048;
const JPEG_QUALITY = 0.72;
const LOCATION_EVENT_NAME = "petsearcher:location-selected";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/bmp",
  "image/gif",
]);

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image-load-failed"));
    image.src = src;
  });

const formatApiMessage = (payload: ApiResponse | null, fallback: string) => {
  const message = typeof payload?.message === "string" && payload.message.trim().length > 0
    ? payload.message.trim()
    : fallback;
  const detail = typeof payload?.detail === "string" && payload.detail.trim().length > 0
    ? payload.detail.trim()
    : "";

  return detail ? `${message} ${detail}` : message;
};

const toPreviewImages = (value: unknown): PreviewImage[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item: unknown): item is PreviewImage =>
      Boolean(
        item &&
          typeof item === "object" &&
          "id" in item &&
          typeof item.id === "string" &&
          "thumbnailUrl" in item &&
          typeof item.thumbnailUrl === "string" &&
          "originalUrl" in item &&
          typeof item.originalUrl === "string" &&
          "name" in item &&
          typeof item.name === "string",
      ),
  );
};

export default function MobileMapPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const tCommon = useTranslations("Common");
  const tIndex = useTranslations("Index");
  const tApi = useTranslations("Api");
  const locale = useLocale();

  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<SelectedAddressDetail | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<RegisteredPetMarker | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>("menu");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [lostPetDate, setLostPetDate] = useState("");
  const [lostPetName, setLostPetName] = useState("");
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [petLossId, setPetLossId] = useState<number | null>(null);
  const [popup, setPopup] = useState<PopupState>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const ignoreNextMapClickRef = useRef(false);

  const openSheet = useCallback(() => {
    setIsSheetOpen(true);
    setDragOffset(0);
    dragOffsetRef.current = 0;
  }, []);

  const closeSheet = useCallback(() => {
    setIsSheetOpen(false);
    setSheetMode("menu");
    setDragOffset(0);
    dragOffsetRef.current = 0;
    dragStartYRef.current = null;
  }, []);

  const startSheetDrag = useCallback((clientY: number) => {
    dragStartYRef.current = clientY;
    dragOffsetRef.current = 0;
    setDragOffset(0);
  }, []);

  const showPopup = useCallback((type: "error" | "success", message: string) => {
    setPopup({ type, message });
  }, []);

  const resetPetForm = useCallback(() => {
    setLostPetDate("");
    setLostPetName("");
    setPreviewImages([]);
    setPetLossId(null);
    setSelectedMarker(null);
    setPopup(null);
    setIsUploading(false);
    setIsSaving(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const compressImage = useCallback(async (file: File) => {
    const objectUrl = URL.createObjectURL(file);

    try {
      const image = await loadImage(objectUrl);
      const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / largestSide);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("canvas-unavailable");
      }

      canvas.width = width;
      canvas.height = height;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (output) => {
            if (!output) {
              reject(new Error("compression-failed"));
              return;
            }

            resolve(output);
          },
          "image/jpeg",
          JPEG_QUALITY,
        );
      });

      const normalizedName = file.name.replace(/\.[^.]+$/, "") || "photo";
      return new File([blob], `${normalizedName}.jpg`, {
        type: "image/jpeg",
        lastModified: file.lastModified,
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }, []);

  const handlePointSelect = useCallback(
    (point: SelectedPoint) => {
      if (ignoreNextMapClickRef.current) {
        ignoreNextMapClickRef.current = false;
        return;
      }

      setSelectedPoint(point);
      setSelectedMarker(null);
      setSheetMode("menu");
      openSheet();
    },
    [openSheet],
  );

  const handleMarkerSelect = useCallback((marker: RegisteredPetMarker) => {
    ignoreNextMapClickRef.current = true;
    setSelectedMarker(marker);
    setSelectedPoint(null);
    setSheetMode("detail");
    openSheet();
  }, [openSheet]);

  const handleLostButton = useCallback(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      void openSignIn();
      return;
    }

    resetPetForm();
    setSheetMode("lost");
    openSheet();
  }, [isLoaded, isSignedIn, openSignIn, openSheet, resetPetForm]);

  const handleFoundButton = useCallback(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      void openSignIn();
      return;
    }

    resetPetForm();
    setSheetMode("found");
    openSheet();
  }, [isLoaded, isSignedIn, openSignIn, openSheet, resetPetForm]);

  const formatMarkerDate = useCallback(
    (value: string | null) => {
      if (!value) {
        return tCommon("not_available");
      }

      const parsedDate = new Date(value);
      if (Number.isNaN(parsedDate.getTime())) {
        return value;
      }

      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(parsedDate);
    },
    [locale, tCommon],
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      event.target.value = "";

      if (files.length === 0) {
        return;
      }

      if (previewImages.length + files.length > MAX_PHOTOS) {
        showPopup("error", tIndex("max_photos_error"));
        return;
      }

      if (files.some((file) => !ALLOWED_IMAGE_MIME_TYPES.has(file.type.toLowerCase()))) {
        showPopup("error", tIndex("image_only_error"));
        return;
      }

      void (async () => {
        setIsUploading(true);

        try {
          const compressedFiles = await Promise.all(files.map((file) => compressImage(file)));
          const formData = new FormData();

          const isFoundMode = sheetMode === "found";

          if (petLossId !== null) {
            formData.append(isFoundMode ? "petFoundId" : "petLossId", String(petLossId));
          }

          if (lostPetDate.trim().length > 0) {
            formData.append(isFoundMode ? "foundPetDate" : "lostPetDate", lostPetDate.trim());
          }

          if (lostPetName.trim().length > 0) {
            formData.append(isFoundMode ? "foundPetName" : "lostPetName", lostPetName.trim());
          }

          compressedFiles.forEach((file) => {
            formData.append("photos", file);
          });

          const response = await fetch(
            isFoundMode ? "/api/found-pet-photos" : "/api/lost-pet-photos",
            {
              method: "POST",
              headers: {
                "x-locale": locale,
              },
              body: formData,
            },
          );

          const payload = (await response.json().catch(() => null)) as ApiResponse | null;

          if (!response.ok) {
            showPopup("error", formatApiMessage(payload, tIndex("upload_photos_error")));
            return;
          }

          if (typeof payload?.petFoundId === "number") {
            setPetLossId(payload.petFoundId);
          } else if (typeof payload?.petLossId === "number") {
            setPetLossId(payload.petLossId);
          }

          setPreviewImages((current) => [...current, ...toPreviewImages(payload?.previewImages)]);
        } catch {
          showPopup("error", tIndex("upload_photos_error"));
        } finally {
          setIsUploading(false);
        }
      })();
    },
    [
      compressImage,
      lostPetDate,
      lostPetName,
      petLossId,
      previewImages.length,
      showPopup,
      locale,
      sheetMode,
      tIndex,
    ],
  );

  const handleSaveLostPet = useCallback(() => {
    void (async () => {
      if (previewImages.length === 0) {
        showPopup("error", tIndex("must_upload_photo"));
        return;
      }

      if (selectedAddress === null) {
        showPopup(
          "error",
          sheetMode === "found"
            ? tIndex("select_found_location_error")
            : tIndex("select_lost_location_error"),
        );
        return;
      }

      if (lostPetDate.trim().length === 0) {
        return;
      }

      if (
        sheetMode === "lost" &&
        (lostPetName.trim().length === 0 || lostPetName.trim().length > LOST_PET_NAME_MAX_LENGTH)
      ) {
        showPopup("error", tIndex("name_max_length_error", { max: LOST_PET_NAME_MAX_LENGTH }));
        return;
      }

      if (petLossId === null) {
        showPopup(
          "error",
          sheetMode === "found"
            ? tApi("no_se_pudo_identificar_el_hallazgo_para_guardar")
            : tApi("no_se_pudo_identificar_la_perdida_para_guardar"),
        );
        return;
      }

      setIsSaving(true);

      try {
        const response = await fetch(
          sheetMode === "found" ? "/api/found-pet-save" : "/api/lost-pet-save",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-locale": locale,
            },
            body: JSON.stringify({
              ...(sheetMode === "found"
                ? {
                    petFoundId: petLossId,
                    foundPetDate: lostPetDate.trim(),
                    foundPetName: lostPetName.trim(),
                  }
                : {
                    petLossId,
                    lostPetDate: lostPetDate.trim(),
                    lostPetName: lostPetName.trim(),
                  }),
              mapboxAddress: selectedAddress,
            }),
          },
        );

        const payload = (await response.json().catch(() => null)) as ApiResponse | null;

        if (!response.ok) {
          showPopup(
            "error",
            sheetMode === "found"
              ? formatApiMessage(payload, tIndex("save_found_error"))
              : formatApiMessage(payload, tIndex("save_lost_error")),
          );
          return;
        }

        if (typeof payload?.petLossId === "number") {
          setPetLossId(payload.petLossId);
        }
        if (typeof payload?.petFoundId === "number") {
          setPetLossId(payload.petFoundId);
        }

        closeSheet();
        showPopup(
          "success",
          sheetMode === "found" ? tIndex("save_success_found") : tIndex("save_success_lost"),
        );
      } catch {
        showPopup("error", sheetMode === "found" ? tIndex("save_found_error") : tIndex("save_lost_error"));
      } finally {
        setIsSaving(false);
      }
    })();
  }, [
    lostPetDate,
    lostPetName,
    petLossId,
    previewImages.length,
    selectedAddress,
    closeSheet,
    locale,
    sheetMode,
    showPopup,
    tApi,
    tIndex,
  ]);

  useEffect(() => {
    const handleLocationSelected = (event: Event) => {
      const customEvent = event as CustomEvent<{
        selected: boolean;
        address?: SelectedAddressDetail;
      }>;

      if (!customEvent.detail.selected || !customEvent.detail.address) {
        setSelectedAddress(null);
        return;
      }

      setSelectedAddress(customEvent.detail.address);
    };

    window.addEventListener(LOCATION_EVENT_NAME, handleLocationSelected as EventListener);
    return () => {
      window.removeEventListener(LOCATION_EVENT_NAME, handleLocationSelected as EventListener);
    };
  }, []);

  const selectedLabel = selectedAddress?.fullAddress ?? (
    selectedPoint
      ? `${selectedPoint.latitude.toFixed(5)}, ${selectedPoint.longitude.toFixed(5)}`
      : ""
  );

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-zinc-950">
      <MapView
        mobileMode
        onMapPointSelect={handlePointSelect}
        onMarkerSelect={handleMarkerSelect}
        selectedMarkerId={selectedMarker?.markerId ?? null}
        selectedMarkerType={selectedMarker?.markerType ?? null}
        searchPanelClassName="w-[min(94vw,40rem)] rounded-3xl border-white/20 bg-white/20 p-3 shadow-none backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/30"
        searchInputClassName="border-white/20 bg-white/30 text-zinc-950 placeholder:text-zinc-700 focus:border-white/40 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-50 dark:placeholder:text-zinc-400"
      />

      <section
        className="fixed inset-x-0 bottom-0 z-40 h-[50vh] rounded-t-[2rem] border-t border-white/15 bg-white/15 shadow-[0_-20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition-transform duration-300 dark:bg-zinc-950/50"
        style={{
          transform: isSheetOpen ? `translateY(${dragOffset}px)` : "translateY(100%)",
        }}
      >
        <div className="flex h-full flex-col">
          <div
            className="flex cursor-grab items-center justify-center py-3 active:cursor-grabbing"
            style={{ touchAction: "none" }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              startSheetDrag(event.clientY);
            }}
            onPointerMove={(event) => {
              if (dragStartYRef.current === null) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
              const offset = Math.max(0, event.clientY - dragStartYRef.current);
              dragOffsetRef.current = offset;
              setDragOffset(offset);
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              event.stopPropagation();

              if (dragOffsetRef.current > 120) {
                closeSheet();
                return;
              }

              setDragOffset(0);
              dragOffsetRef.current = 0;
              dragStartYRef.current = null;
            }}
            onPointerCancel={() => {
              setDragOffset(0);
              dragOffsetRef.current = 0;
              dragStartYRef.current = null;
            }}
          >
            <div className="h-1.5 w-16 rounded-full bg-white/60" />
          </div>

          {sheetMode === "detail" && selectedMarker ? (
            <div className="flex-1 overflow-auto px-4 pb-5 pt-4">
              <div className="space-y-3 rounded-3xl border border-white/15 bg-black/10 p-4 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">
                      {selectedMarker.petName ?? tCommon("not_available")}
                    </p>
                    <p className="mt-1 text-sm text-white/75">
                      {selectedMarker.markerType === "found"
                        ? tCommon("date_found")
                        : tCommon("date_lost")}
                      : {formatMarkerDate(selectedMarker.lostPetDate)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/30"
                    onClick={closeSheet}
                  >
                    {tCommon("close")}
                  </button>
                </div>

                <div className="space-y-2 text-sm text-white/85">
                  <p>
                    <span className="font-semibold">{tCommon("published_by")}</span>{" "}
                    {selectedMarker.creatorName ?? tCommon("not_available")}
                  </p>
                  <p>
                    <span className="font-semibold">{tCommon("email")}</span>{" "}
                    {selectedMarker.creatorEmail ?? tCommon("not_available")}
                  </p>
                  <p>
                    <span className="font-semibold">
                      {selectedMarker.markerType === "found"
                        ? tCommon("se_found_near")
                        : tCommon("se_lost_near")}
                    </span>{" "}
                    {selectedMarker.fullAddress}
                  </p>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-2">
                  {selectedMarker.photos.length > 0 ? (
                    selectedMarker.photos.map((photo, index) => (
                      <img
                        key={`${selectedMarker.markerType}-${selectedMarker.markerId}-${index}`}
                        src={photo.thumbnailUrl}
                        alt={selectedMarker.petName ?? tCommon("not_available")}
                        className="h-16 w-16 flex-none rounded-xl border border-white/15 object-cover"
                      />
                    ))
                  ) : (
                    <p className="px-2 py-3 text-sm text-white/65">
                      {tCommon("not_available")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : sheetMode === "menu" ? (
            <div className="flex-1 px-4 pb-5 pt-4">
              <button
                type="button"
                className="w-full rounded-2xl bg-white/20 px-4 py-4 text-left text-base font-semibold text-white transition hover:bg-white/30"
                onClick={handleLostButton}
              >
                {tIndex("lost_pet_button")}
              </button>
              <button
                type="button"
                className="mt-3 w-full rounded-2xl bg-white/20 px-4 py-4 text-left text-base font-semibold text-white transition hover:bg-white/30"
                onClick={handleFoundButton}
              >
                {tIndex("found_pet_button")}
              </button>
              {selectedLabel ? (
                <p className="mt-4 text-sm text-white/75">{selectedLabel}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex-1 overflow-auto px-4 pb-5 pt-4">
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white">
                    {sheetMode === "found" ? tCommon("date_found") : tCommon("date_lost")}
                  </span>
                  <input
                    type="date"
                    value={lostPetDate}
                    onChange={(event) => setLostPetDate(event.target.value)}
                    inputMode="numeric"
                    className="w-full rounded-2xl border border-white/20 bg-white/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/60"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white">
                    {tIndex("responds_to_name")}
                  </span>
                  <input
                    type="text"
                    maxLength={LOST_PET_NAME_MAX_LENGTH}
                    value={lostPetName}
                    onChange={(event) => setLostPetName(event.target.value)}
                    className="w-full rounded-2xl border border-white/20 bg-white/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/60"
                  />
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.bmp,.gif,image/png,image/jpeg,image/bmp,image/gif"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />

                <button
                  type="button"
                  className="w-full rounded-2xl border border-white/20 bg-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/30 disabled:opacity-60"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isSaving}
                >
                  {tCommon("upload")}
                </button>

                <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/10 p-3">
                  {previewImages.length > 0 ? (
                    previewImages.map((preview) => (
                      <img
                        key={preview.id}
                        src={preview.thumbnailUrl}
                        alt={preview.name}
                        className="h-16 w-16 flex-none rounded-xl border border-white/20 object-cover"
                      />
                    ))
                  ) : (
                    <p className="text-sm text-white/65">{tIndex("photos_label")}</p>
                  )}
                </div>

                <button
                  type="button"
                  className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition disabled:opacity-60"
                  disabled={
                    isSaving ||
                    isUploading ||
                    previewImages.length === 0 ||
                    lostPetDate.trim().length === 0 ||
                    (sheetMode === "found" ? false : lostPetName.trim().length === 0)
                  }
                  onClick={handleSaveLostPet}
                >
                  {isSaving ? tCommon("saving") : tCommon("save")}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {popup ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-4 pb-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-4 shadow-2xl ${
              popup.type === "error"
                ? "border-red-300 bg-red-50 text-red-900"
                : "border-emerald-300 bg-emerald-50 text-emerald-900"
            }`}
            role="alertdialog"
            aria-modal="true"
          >
            <p className="text-sm font-medium">{popup.message}</p>
            <button
              type="button"
              className={`mt-3 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                popup.type === "error"
                  ? "bg-red-200 text-red-900 hover:bg-red-300"
                  : "bg-emerald-200 text-emerald-900 hover:bg-emerald-300"
              }`}
              onClick={() => setPopup(null)}
            >
              {tCommon("close")}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
