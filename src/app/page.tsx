"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ChangeEvent, useState } from "react";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-100 dark:bg-zinc-900">
      <p className="text-zinc-500">Cargando mapa…</p>
    </div>
  ),
});

export default function Home() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [showLostPetForm, setShowLostPetForm] = useState(false);
  const [photoError, setPhotoError] = useState("");

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

    setPhotoError("");
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <MapView />

      <section
        className={`absolute inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/90 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] transition-[height] duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-950/90 ${
          isPanelOpen ? "h-[calc(20vh+25px)]" : "h-14"
        }`}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <Link
              href="/"
              scroll={false}
              className="text-zinc-700 transition hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-white"
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
                    <input
                      id="lost-pet-photos"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoChange}
                      className="w-[150px] max-w-[150px] flex-none overflow-hidden rounded-xl border border-zinc-200 bg-white px-2 py-2 text-zinc-900 outline-none transition file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-2 file:py-1 file:text-xs file:font-medium file:text-white hover:border-zinc-300 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:file:bg-zinc-100 dark:file:text-zinc-900 dark:focus:border-zinc-600"
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
                    onClick: () => setShowLostPetForm(true),
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
    </main>
  );
}
