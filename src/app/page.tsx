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

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [showLostPetForm, setShowLostPetForm] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const uploadResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (uploadResetTimerRef.current !== null) {
        window.clearTimeout(uploadResetTimerRef.current);
      }
    };
  }, []);

  const resetUploadProgress = useCallback(() => {
    if (uploadResetTimerRef.current !== null) {
      window.clearTimeout(uploadResetTimerRef.current);
      uploadResetTimerRef.current = null;
    }

    setUploadProgress(null);
  }, []);

  const uploadPhotos = useCallback(
    (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      resetUploadProgress();
      setPhotoError("");
      setUploadError("");
      setUploadProgress(0);

      const formData = new FormData();
      files.forEach((file) => {
        formData.append("photos", file);
      });

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
          setUploadProgress(null);
          return;
        }

        setUploadProgress(100);
        uploadResetTimerRef.current = window.setTimeout(() => {
          setUploadProgress(null);
          uploadResetTimerRef.current = null;
        }, 700);
      };

      request.onerror = () => {
        setUploadError("No se pudieron subir las fotos.");
        setUploadProgress(null);
      };

      request.send(formData);
    },
    [resetUploadProgress],
  );

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;

    if (!selectedFiles) {
      setPhotoError("");
      return;
    }

    if (selectedFiles.length > 10) {
      setPhotoError("Puedes seleccionar hasta 10 fotos.");
      event.target.value = "";
      return;
    }

    const files = Array.from(selectedFiles);
    const hasNonImage = files.some((file) => !file.type.startsWith("image/"));
    if (hasNonImage) {
      setPhotoError("Solo se permiten archivos de imagen.");
      event.target.value = "";
      return;
    }

    setPhotoError("");
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

    setShowLostPetForm(true);
  }, [isLoaded, isSignedIn, openSignIn]);

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
                setPhotoError("");
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
              <form className="flex max-w-xl flex-col items-start gap-4">
                <div className="flex w-full flex-nowrap items-start gap-4">
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
                      className="w-[150px] max-w-[150px] flex-none rounded-xl border border-zinc-200 bg-white px-2 py-2 text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <label
                      htmlFor="lost-pet-photos"
                      className="shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-200"
                    >
                      Fotos (max 10)
                    </label>
                    <button
                      type="button"
                      className="flex-none rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
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
                    {photoError ? (
                      <p className="text-sm text-red-600">{photoError}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex w-full items-center gap-3">
                  <label
                    htmlFor="lost-pet-name"
                    className="shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-200"
                  >
                    Nombre al que responde
                  </label>
                  <input
                    id="lost-pet-name"
                    type="text"
                    className="w-[150px] max-w-[150px] flex-none rounded-xl border border-zinc-200 bg-white px-2 py-2 text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
                  />
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

      {uploadError ? (
        <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,28rem)] rounded-xl border border-red-700 bg-red-600 p-4 text-white shadow-xl">
          <p className="text-sm font-medium">{uploadError}</p>
          <button
            type="button"
            className="mt-3 rounded-md bg-red-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-900"
            onClick={() => setUploadError("")}
          >
            Cerrar
          </button>
        </div>
      ) : null}
    </main>
  );
}
