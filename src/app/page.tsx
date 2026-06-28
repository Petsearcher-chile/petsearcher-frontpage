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
        <button
          type="button"
          className="flex h-14 w-full items-center justify-between px-4 text-sm font-medium text-zinc-700 dark:text-zinc-200"
          onClick={() => setIsPanelOpen((current) => !current)}
        >
          <span>Zona de componentes</span>
          <span>{isPanelOpen ? "Ocultar" : "Mostrar"}</span>
        </button>

        {isPanelOpen ? (
          <div className="h-[calc(100%-3.5rem)] overflow-auto px-4 pb-4">
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-zinc-200 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Aquí van los componentes
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
