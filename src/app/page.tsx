"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

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

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <MapView />

      <section
        className={`absolute inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/90 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] transition-[height] duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-950/90 ${
          isPanelOpen ? "h-[20vh]" : "h-14"
        }`}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Zona de componentes
          </span>
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
            <div className="grid h-full gap-3 md:grid-cols-3">
              {[
                "Perdí una mascota",
                "Encontré una mascota",
                "Regalo mascotas",
              ].map((label) => (
                <button
                  key={label}
                  type="button"
                  className="flex min-h-24 cursor-pointer items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-center text-base font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
