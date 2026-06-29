"use client";

import MapView from "@/components/MapView";

export default function MobileMapPage() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-zinc-950">
      <MapView
        searchPanelClassName="w-[min(94vw,40rem)] rounded-3xl border-white/20 bg-white/20 p-3 shadow-none backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/30"
        searchInputClassName="border-white/20 bg-white/30 text-zinc-950 placeholder:text-zinc-700 focus:border-white/40 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-50 dark:placeholder:text-zinc-400"
      />
    </main>
  );
}
