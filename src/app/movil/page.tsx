"use client";

import { useTranslations } from "next-intl";
import { useCallback, useRef, useState, type ChangeEvent } from "react";
import MapView from "@/components/MapView";

type SelectedPoint = {
  longitude: number;
  latitude: number;
};

type SheetMode = "menu" | "lost";

type UploadedFile = {
  id: string;
  file: File;
};

const LOST_PET_NAME_MAX_LENGTH = 30;
const MAX_PHOTOS = 10;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/bmp",
  "image/gif",
]);

export default function MobileMapPage() {
  const tCommon = useTranslations("Common");
  const tIndex = useTranslations("Index");
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>("menu");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [lostPetDate, setLostPetDate] = useState("");
  const [lostPetName, setLostPetName] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [petLossId, setPetLossId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);

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

  const handlePointSelect = useCallback(
    (point: SelectedPoint) => {
      setSelectedPoint(point);
      setSheetMode("menu");
      openSheet();
    },
    [openSheet],
  );

  const handleLostButton = useCallback(() => {
    setSheetMode("lost");
    setUploadError("");
    setSaveSuccessMessage("");
    openSheet();
  }, [openSheet]);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      event.target.value = "";

      if (files.length === 0) {
        return;
      }

      if (files.length + uploadedFiles.length > MAX_PHOTOS) {
        setUploadError(tIndex("max_photos_error"));
        return;
      }

      if (files.some((file) => !ALLOWED_IMAGE_MIME_TYPES.has(file.type.toLowerCase()))) {
        setUploadError(tIndex("image_only_error"));
        return;
      }

      setUploadError("");
      setSaveSuccessMessage("");
      setUploadedFiles((current) => [
        ...current,
        ...files.map((file) => ({ id: crypto.randomUUID(), file })),
      ]);
    },
    [tIndex, uploadedFiles.length],
  );

  const handleSaveLostPet = useCallback(() => {
    void (async () => {
      if (lostPetName.trim().length > LOST_PET_NAME_MAX_LENGTH) {
        setUploadError(tIndex("name_max_length_error", { max: LOST_PET_NAME_MAX_LENGTH }));
        return;
      }

      if (uploadedFiles.length === 0) {
        setUploadError(tIndex("must_upload_photo"));
        return;
      }

      setIsSaving(true);
      setUploadError("");

      const formData = new FormData();
      if (petLossId !== null) {
        formData.append("petLossId", String(petLossId));
      }
      formData.append("lostPetDate", lostPetDate);
      formData.append("lostPetName", lostPetName.trim());
      uploadedFiles.forEach(({ file }) => {
        formData.append("photos", file);
      });

      try {
        const response = await fetch("/api/lost-pet-photos", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const payload = (await response.json()) as { message?: string; detail?: string };
          setUploadError(payload.detail ? `${payload.message ?? ""} ${payload.detail}`.trim() : payload.message ?? tIndex("upload_photos_error"));
          return;
        }

        const payload = (await response.json()) as { petLossId?: number };
        if (typeof payload.petLossId === "number") {
          setPetLossId(payload.petLossId);
        }
        setSaveSuccessMessage(tIndex("save_success_lost"));
      } catch {
        setUploadError(tIndex("upload_photos_error"));
      } finally {
        setIsSaving(false);
      }
    })();
  }, [lostPetDate, lostPetName, petLossId, tIndex, uploadedFiles]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-zinc-950">
      <MapView
        mobileMode
        onMapPointSelect={handlePointSelect}
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

          {sheetMode === "menu" ? (
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
                onClick={() => setSheetMode("menu")}
              >
                {tIndex("found_pet_button")}
              </button>
              {selectedPoint ? (
                <p className="mt-4 text-sm text-white/75">
                  {selectedPoint.latitude.toFixed(5)}, {selectedPoint.longitude.toFixed(5)}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex-1 overflow-auto px-4 pb-5 pt-4">
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white">
                    {tCommon("date_lost")}
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
                  className="w-full rounded-2xl border border-white/20 bg-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/30"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {tCommon("upload")}
                </button>

                {uploadedFiles.length > 0 ? (
                  <div className="max-h-24 space-y-2 overflow-auto rounded-2xl border border-white/10 bg-black/10 p-3 text-sm text-white/80">
                    {uploadedFiles.map((item) => (
                      <p key={item.id} className="truncate">
                        {item.file.name}
                      </p>
                    ))}
                  </div>
                ) : null}

                {uploadError ? <p className="text-sm text-red-200">{uploadError}</p> : null}
                {saveSuccessMessage ? (
                  <p className="text-sm text-emerald-200">{saveSuccessMessage}</p>
                ) : null}

                <button
                  type="button"
                  disabled={isSaving}
                  className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition disabled:opacity-60"
                  onClick={handleSaveLostPet}
                >
                  {isSaving ? tCommon("saving") : tCommon("save")}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
