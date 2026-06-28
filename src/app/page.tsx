"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-100 dark:bg-zinc-900">
      <p className="text-zinc-500">Cargando mapa…</p>
    </div>
  ),
});

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

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showLostPetForm, setShowLostPetForm] = useState(false);
  const [petLossId, setPetLossId] = useState<number | null>(null);
  const [lostPetDate, setLostPetDate] = useState("");
  const [lostPetName, setLostPetName] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSelectedLocation, setHasSelectedLocation] = useState(false);
  const [selectedAddressDetail, setSelectedAddressDetail] =
    useState<SelectedAddressDetail | null>(null);
  const [uploadedThumbnailPreviews, setUploadedThumbnailPreviews] = useState<
    { id: string; url: string; name: string }[]
  >([]);
  const [hoveredPreview, setHoveredPreview] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const uploadResetTimerRef = useRef<number | null>(null);
  const thumbnailUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const handleLocationSelected = (event: Event) => {
      const customEvent = event as CustomEvent<{
        selected?: boolean;
        address?: SelectedAddressDetail;
      }>;
      const selected = Boolean(customEvent.detail?.selected);
      setHasSelectedLocation(selected);
      setSelectedAddressDetail(selected ? (customEvent.detail?.address ?? null) : null);
    };

    window.addEventListener("petsearcher:location-selected", handleLocationSelected);

    return () => {
      window.removeEventListener(
        "petsearcher:location-selected",
        handleLocationSelected,
      );
      if (uploadResetTimerRef.current !== null) {
        window.clearTimeout(uploadResetTimerRef.current);
      }
      thumbnailUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const resetUploadProgress = useCallback(() => {
    if (uploadResetTimerRef.current !== null) {
      window.clearTimeout(uploadResetTimerRef.current);
      uploadResetTimerRef.current = null;
    }

    setUploadProgress(null);
  }, []);

  const clearThumbnailPreviews = useCallback(() => {
    thumbnailUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    thumbnailUrlsRef.current = [];
    setUploadedThumbnailPreviews([]);
    setHoveredPreview(null);
  }, []);

  const uploadPhotos = useCallback(
    (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      resetUploadProgress();
      setPhotoError("");
      setUploadError("");
      setSaveSuccessMessage("");
      setUploadProgress(0);

      const formData = new FormData();
      if (petLossId !== null) {
        formData.append("petLossId", String(petLossId));
      }
      formData.append("lostPetDate", lostPetDate);
      formData.append("lostPetName", lostPetName);
      files.forEach((file) => {
        formData.append("photos", file);
      });
      const pendingPreviews = files.map((file) => ({
        id: crypto.randomUUID(),
        url: URL.createObjectURL(file),
        name: file.name,
      }));

      const request = new XMLHttpRequest();
      request.open("POST", "/api/lost-pet-photos");
      request.responseType = "json";

      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }

        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      };

      request.onload = () => {
        if (request.status < 200 || request.status >= 300) {
          const responseMessage =
            request.response &&
            typeof request.response === "object" &&
            "message" in request.response
              ? typeof request.response.message === "string"
                ? request.response.detail &&
                  typeof request.response.detail === "string"
                  ? `${request.response.message} ${request.response.detail}`
                  : request.response.message
                : "No se pudieron subir las fotos."
              : "No se pudieron subir las fotos.";
          setUploadError(responseMessage);
          pendingPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
          setUploadProgress(null);
          return;
        }

        const responsePetLossId =
          request.response &&
          typeof request.response === "object" &&
          "petLossId" in request.response &&
          typeof request.response.petLossId === "number"
            ? request.response.petLossId
            : null;
        if (responsePetLossId !== null) {
          setPetLossId(responsePetLossId);
        }

        thumbnailUrlsRef.current.push(...pendingPreviews.map((preview) => preview.url));
        setUploadedThumbnailPreviews((current) => [...current, ...pendingPreviews]);

        setUploadProgress(100);
        uploadResetTimerRef.current = window.setTimeout(() => {
          setUploadProgress(null);
          uploadResetTimerRef.current = null;
        }, 700);
      };

      request.onerror = () => {
        setUploadError("No se pudieron subir las fotos.");
        pendingPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
        setUploadProgress(null);
      };

      request.send(formData);
    },
    [lostPetDate, lostPetName, petLossId, resetUploadProgress],
  );

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;

    if (!selectedFiles) {
      setPhotoError("");
      return;
    }

    if (selectedFiles.length + uploadedThumbnailPreviews.length > 10) {
      setPhotoError("");
      setUploadError("Puedes seleccionar hasta 10 fotos.");
      event.target.value = "";
      return;
    }

    const files = Array.from(selectedFiles);
    const hasNonImage = files.some((file) => !file.type.startsWith("image/"));
    if (hasNonImage) {
      setPhotoError("");
      setUploadError("Solo se permiten archivos de imagen.");
      event.target.value = "";
      return;
    }

    setPhotoError("");
    setSaveSuccessMessage("");
    event.target.value = "";
    uploadPhotos(files);
  };

  const handleLostPetClick = useCallback(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      void openSignIn();
      return;
    }

    setSaveSuccessMessage("");
    setShowLostPetForm(true);
  }, [isLoaded, isSignedIn, openSignIn]);

  const lostPetNamePattern = /^(?!.*[ _\-°ñÑ]{2})[a-zA-Z0-9°_\-ñÑ ]+$/;
  const isLostPetNameValid =
    lostPetName.trim().length > 0 && lostPetNamePattern.test(lostPetName);
  const isSaveEnabled =
    uploadedThumbnailPreviews.length > 0 &&
    lostPetDate.trim().length > 0 &&
    isLostPetNameValid;

  const handleSaveClick = useCallback(() => {
    if (!hasSelectedLocation) {
      setUploadError(
        "Debe seleccionar un lugar donde se perdió su mascota, arriba en el buscador, busque su dirección",
      );
      return;
    }

    if (!selectedAddressDetail) {
      setUploadError(
        "Debe seleccionar un lugar donde se perdió su mascota, arriba en el buscador, busque su dirección",
      );
      return;
    }

    if (petLossId === null) {
      setUploadError("Debes subir al menos una foto antes de guardar.");
      return;
    }

    setIsSaving(true);
    void fetch("/api/lost-pet-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        petLossId,
        lostPetDate,
        lostPetName,
        mapboxAddress: selectedAddressDetail,
      }),
    })
      .then(async (response) => {
        if (response.ok) {
          setUploadError("");
          setPhotoError("");
          setShowLostPetForm(false);
          setIsPanelOpen(false);
          setPetLossId(null);
          setLostPetDate("");
          setLostPetName("");
          setHasSelectedLocation(false);
          setSelectedAddressDetail(null);
          clearThumbnailPreviews();
          setSaveSuccessMessage(
            "Lamentamos mucho el extravío de su mascota. En caso de que alguien la encuentre, será contactado por el correo que utilizó para identificarse.",
          );
          return;
        }

        const payload = (await response.json()) as { message?: string; detail?: string };
        const errorMessage =
          payload.message && payload.detail
            ? `${payload.message} ${payload.detail}`
            : payload.message ?? "No se pudo guardar la pérdida.";
        setUploadError(errorMessage);
      })
      .catch(() => {
        setUploadError("No se pudo guardar la pérdida.");
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, [
    clearThumbnailPreviews,
    hasSelectedLocation,
    lostPetDate,
    lostPetName,
    petLossId,
    selectedAddressDetail,
  ]);

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <MapView />

      <section
        className={`absolute inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/90 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] transition-[height] duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-950/90 ${
          isPanelOpen ? "h-[calc(20vh+25px)]" : "h-14"
        }`}
      >
        {uploadProgress !== null ? (
          <div className="absolute inset-x-0 top-0 h-1 bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full bg-blue-600 transition-[width] duration-150 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        ) : null}

        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <Link
              href="/"
              scroll={false}
              className="text-blue-600 underline transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              onClick={() => {
                setShowLostPetForm(false);
                setPetLossId(null);
                setLostPetDate("");
                setLostPetName("");
                setHasSelectedLocation(false);
                setSelectedAddressDetail(null);
                setPhotoError("");
                setUploadError("");
                setSaveSuccessMessage("");
                clearThumbnailPreviews();
              }}
            >
              inicio
            </Link>
            {showLostPetForm ? <span>&gt; mascota extraviada</span> : null}
          </div>
          <button
            type="button"
            aria-label={isPanelOpen ? "Ocultar zona de componentes" : "Mostrar zona de componentes"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={() => setIsPanelOpen((current) => !current)}
          >
            {isPanelOpen ? (
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5">
                <path
                  d="M5 12l5-5 5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5">
                <path
                  d="M5 8l5 5 5-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>

        {isPanelOpen ? (
          <div className="h-[calc(100%-3.5rem)] overflow-auto px-4 pb-4">
            {showLostPetForm ? (
              <form className="flex w-full flex-col gap-4">
                <div className="flex w-full flex-nowrap items-start gap-6">
                  <div className="w-[360px] flex-none">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                    <label
                      htmlFor="lost-pet-date"
                      className="shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-200"
                    >
                      Fecha en la que se perdió
                    </label>
                    <input
                      id="lost-pet-date"
                      type="date"
                      value={lostPetDate}
                      onChange={(event) => setLostPetDate(event.target.value)}
                      className="w-[150px] max-w-[150px] flex-none rounded-xl border border-zinc-200 bg-white px-2 py-2 text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
                    />
                  </div>

                      <div className="flex items-center gap-3">
                        <label
                          htmlFor="lost-pet-name"
                          className="shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-200"
                        >
                          Nombre al que responde
                        </label>
                        <input
                          id="lost-pet-name"
                          type="text"
                          value={lostPetName}
                          onChange={(event) => setLostPetName(event.target.value)}
                          className="w-[150px] max-w-[150px] flex-none rounded-xl border border-zinc-200 bg-white px-2 py-2 text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor="lost-pet-photos"
                        className="shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-200"
                      >
                        Fotos (max 10)
                      </label>
                      <button
                        type="button"
                        className="flex-none cursor-pointer rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                        onClick={() => photoInputRef.current?.click()}
                      >
                        subir
                      </button>
                      <input
                        ref={photoInputRef}
                        id="lost-pet-photos"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoChange}
                        className="sr-only"
                      />
                      <button
                        type="button"
                        disabled={!isSaveEnabled || isSaving}
                        className="ml-auto cursor-pointer rounded-xl border border-zinc-200 bg-white px-5 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:disabled:border-zinc-800 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                        onClick={handleSaveClick}
                      >
                        {isSaving ? "Guardando..." : "Guardar"}
                      </button>
                    </div>

                    <div className="flex min-w-0 items-center gap-2 overflow-x-auto rounded-lg px-1 py-1">
                      {uploadedThumbnailPreviews.map((preview) => (
                        <img
                          key={preview.id}
                          src={preview.url}
                          alt={preview.name}
                          className="h-16 w-16 cursor-pointer flex-none rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
                          onMouseEnter={() =>
                            setHoveredPreview({
                              url: preview.url,
                              name: preview.name,
                            })
                          }
                          onMouseLeave={() => setHoveredPreview(null)}
                        />
                      ))}
                    </div>

                    {photoError ? (
                      <p className="text-sm text-red-600">{photoError}</p>
                    ) : null}
                  </div>
                </div>

              </form>
            ) : (
              <div className="grid h-full gap-3 md:grid-cols-3">
                {[
                  {
                    label: "Perdí una mascota",
                    onClick: handleLostPetClick,
                  },
                  {
                    label: "Encontré una mascota",
                    onClick: undefined,
                  },
                  {
                    label: "Regalo mascotas",
                    onClick: undefined,
                  },
                ].map(({ label, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    className="flex min-h-24 cursor-pointer items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-center text-base font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                    onClick={onClick}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </section>

      {hoveredPreview ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="rounded-lg border border-zinc-300 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <img
              src={hoveredPreview.url}
              alt={hoveredPreview.name}
              className="h-[22rem] w-[22rem] rounded-md object-contain"
            />
          </div>
        </div>
      ) : null}

      {uploadError ? (
        <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,28rem)] rounded-xl border border-red-300 bg-red-100 p-4 text-red-900 shadow-xl">
          <p className="text-sm font-medium">{uploadError}</p>
          <button
            type="button"
            className="mt-3 rounded-md bg-red-200 px-3 py-1.5 text-sm font-medium text-red-900 transition hover:bg-red-300"
            onClick={() => setUploadError("")}
          >
            Cerrar
          </button>
        </div>
      ) : null}

      {saveSuccessMessage ? (
        <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,28rem)] rounded-xl border border-emerald-300 bg-emerald-100 p-4 text-emerald-900 shadow-xl">
          <p className="text-sm font-medium">{saveSuccessMessage}</p>
          <button
            type="button"
            className="mt-3 rounded-md bg-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-900 transition hover:bg-emerald-300"
            onClick={() => setSaveSuccessMessage("")}
          >
            Cerrar
          </button>
        </div>
      ) : null}
    </main>
  );
}
