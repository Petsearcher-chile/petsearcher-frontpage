"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import MapView from "@/components/MapView";

type SelectedPoint = {
  longitude: number;
  latitude: number;
};

type ReportType = "lost" | "found" | null;

export default function MobileMapPage() {
  const router = useRouter();
  const tIndex = useTranslations("Index");
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<ReportType>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  const openSheet = useCallback(() => {
    setIsSheetOpen(true);
    setDragOffset(0);
    dragOffsetRef.current = 0;
  }, []);

  const closeSheet = useCallback(() => {
    setIsSheetOpen(false);
    setDragOffset(0);
    dragOffsetRef.current = 0;
    dragStartYRef.current = null;
  }, []);

  const handlePointSelect = useCallback(
    (point: SelectedPoint) => {
      setSelectedPoint(point);
      openSheet();
    },
    [openSheet],
  );

  const handleReportSelect = useCallback(
    (reportType: Exclude<ReportType, null>) => {
      setSelectedReportType(reportType);
      const params = new URLSearchParams(window.location.search);
      params.set("report", reportType);
      router.replace(params.toString() ? `/movil?${params.toString()}` : "/movil");
    },
    [router],
  );

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
          transform: isSheetOpen
            ? `translateY(${dragOffset}px)`
            : "translateY(100%)",
        }}
      >
        <div
          className="flex h-full flex-col"
          onPointerMove={(event) => {
            if (dragStartYRef.current === null) {
              return;
            }

            const offset = Math.max(0, event.clientY - dragStartYRef.current);
            dragOffsetRef.current = offset;
            setDragOffset(offset);
          }}
          onPointerUp={() => {
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
          <button
            type="button"
            className="mx-auto mt-3 h-1.5 w-16 rounded-full bg-white/60"
            aria-label="Drag handle"
            onPointerDown={(event) => {
              dragStartYRef.current = event.clientY;
              (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
            }}
          />

          <div className="flex-1 px-4 pb-5 pt-4">
            <div className="mb-4 h-px w-full bg-white/15" />
            <div className="grid gap-3">
              <button
                type="button"
                className={`w-full rounded-2xl px-4 py-4 text-left text-base font-semibold transition ${
                  selectedReportType === "lost"
                    ? "bg-red-500/90 text-white"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
                onClick={() => handleReportSelect("lost")}
              >
                {tIndex("lost_pet_button")}
              </button>
              <button
                type="button"
                className={`w-full rounded-2xl px-4 py-4 text-left text-base font-semibold transition ${
                  selectedReportType === "found"
                    ? "bg-blue-500/90 text-white"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
                onClick={() => handleReportSelect("found")}
              >
                {tIndex("found_pet_button")}
              </button>
            </div>
            {selectedPoint ? (
              <p className="mt-4 text-sm text-white/75">
                {selectedPoint.latitude.toFixed(5)}, {selectedPoint.longitude.toFixed(5)}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
