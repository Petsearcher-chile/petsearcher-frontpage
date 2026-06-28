"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
  Marker,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
const GEOCODE_ENDPOINT = "https://api.mapbox.com/geocoding/v5/mapbox.places";
const SELECT_ZOOM = 16;
const LOCATION_EVENT_NAME = "petsearcher:location-selected";

type LocationSuggestion = {
  id: string;
  place_name: string;
  center: [number, number];
};

// Santiago, Chile
const DEFAULT_CENTER = {
  longitude: -70.6483,
  latitude: -33.4489,
};

export default function MapView() {
  const mapRef = useRef<MapRef>(null);
  const selectedQueryRef = useRef("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<{
    longitude: number;
    latitude: number;
  } | null>(null);

  const handleLoad = useCallback(() => {
    mapRef.current?.resize();
  }, []);

  const hasToken = MAPBOX_TOKEN.length > 0;

  const emitLocationSelected = useCallback((selected: boolean) => {
    window.dispatchEvent(
      new CustomEvent<{ selected: boolean }>(LOCATION_EVENT_NAME, {
        detail: { selected },
      }),
    );
  }, []);

  const handleQueryChange = useCallback((value: string) => {
    if (value !== selectedQueryRef.current) {
      selectedQueryRef.current = "";
      emitLocationSelected(false);
    }

    setSearchQuery(value);
    setSearchError(null);

    if (!value.trim()) {
      setResults([]);
    }
  }, [emitLocationSelected]);

  const fetchSuggestions = useCallback(
    async (query: string, signal: AbortSignal) => {
      if (!hasToken) {
        setSearchError("Falta configurar NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.");
        return;
      }

      const response = await fetch(
        `${GEOCODE_ENDPOINT}/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5&language=es`,
        { signal },
      );

      if (!response.ok) {
        throw new Error("No se pudo buscar la ubicación.");
      }

      const data: { features?: LocationSuggestion[] } = await response.json();
      setResults(data.features ?? []);
      setSearchError(null);
    },
    [hasToken],
  );

  useEffect(() => {
    const query = searchQuery.trim();

    if (!query) {
      selectedQueryRef.current = "";
      return;
    }

    if (query === selectedQueryRef.current) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void fetchSuggestions(query, controller.signal).catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setResults([]);

        if (error instanceof Error && error.message === "No se pudo buscar la ubicación.") {
          setSearchError(error.message);
          return;
        }

        setSearchError("No se pudo buscar la ubicación.");
      });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fetchSuggestions, searchQuery]);

  const handleSelectResult = useCallback((result: LocationSuggestion) => {
    selectedQueryRef.current = result.place_name;
    setSearchQuery(result.place_name);
    setResults([]);
    setSearchError(null);
    const longitude = result.center[0];
    const latitude = result.center[1];

    setSelectedPoint({ longitude, latitude });
    emitLocationSelected(true);
    const map = mapRef.current;

    if (map) {
      map.jumpTo({
        center: [longitude, latitude],
        zoom: SELECT_ZOOM,
      });
    }
  }, [emitLocationSelected]);

  const searchAndSelect = useCallback(
    async (query: string) => {
      if (!hasToken) {
        setSearchError("Falta configurar NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.");
        return;
      }

      const response = await fetch(
        `${GEOCODE_ENDPOINT}/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=1&language=es`,
      );

      if (!response.ok) {
        throw new Error("No se pudo buscar la ubicación.");
      }

      const data: { features?: LocationSuggestion[] } = await response.json();
      const [result] = data.features ?? [];

      if (!result) {
        setSearchError("No se encontraron resultados.");
        return;
      }

      handleSelectResult(result);
    },
    [hasToken, handleSelectResult],
  );

  return (
    <div className="relative h-full w-full overflow-hidden">
      <form
        className="absolute left-1/2 top-4 z-10 w-[min(92vw,42rem)] -translate-x-1/2 rounded-2xl border border-white/30 bg-white/70 p-3 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/60"
        onSubmit={(event) => {
          event.preventDefault();
          const query = searchQuery.trim();

          if (!query) {
            return;
          }

          if (results[0]) {
            handleSelectResult(results[0]);
            return;
          }

          void searchAndSelect(query).catch(() => {
            setResults([]);
            setSearchError("No se pudo buscar la ubicación.");
          });
        }}
      >
        <label htmlFor="location-search" className="sr-only">
          Buscar ubicación
        </label>
        <div className="flex">
          <input
            id="location-search"
            type="text"
            value={searchQuery}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Buscar ciudad, dirección o lugar"
            className="h-11 flex-1 rounded-xl border border-zinc-200 bg-white/90 px-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:placeholder:text-zinc-400"
          />
        </div>
        {searchError ? (
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            {searchError}
          </p>
        ) : null}
        {results.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {results.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleSelectResult(result);
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-white/80 px-4 py-3 text-left text-sm text-zinc-800 transition hover:border-zinc-300 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-900"
                >
                  {result.place_name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>

      <Map
        ref={mapRef}
        initialViewState={{
          ...DEFAULT_CENTER,
          zoom: 12,
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: "100%", height: "100%" }}
        onLoad={handleLoad}
        reuseMaps
      >
        {selectedPoint ? (
          <Marker
            longitude={selectedPoint.longitude}
            latitude={selectedPoint.latitude}
            anchor="bottom"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 48 64"
              className="h-16 w-12 drop-shadow-lg"
            >
              <path
                d="M24 2C12.4 2 3 11.4 3 23c0 15.4 21 39 21 39s21-23.6 21-39C45 11.4 35.6 2 24 2Z"
                fill="#ef4444"
              />
              <circle cx="24" cy="23" r="10" fill="#ffffff" />
              <circle cx="24" cy="23" r="5.5" fill="#ef4444" />
            </svg>
          </Marker>
        ) : null}
        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" trackUserLocation />
      </Map>
    </div>
  );
}
