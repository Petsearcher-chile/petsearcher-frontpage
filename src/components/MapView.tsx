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
const AUTOSELECT_REQUEST_EVENT_NAME = "petsearcher:location-autoselect-request";

type LocationSuggestion = {
  id: string;
  place_name: string;
  center: [number, number];
  text?: string;
  address?: string;
  context?: { id: string; text: string }[];
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

export type RegisteredPetMarker = {
  petLossId: number;
  longitude: number;
  latitude: number;
  fullAddress: string;
  petName: string | null;
  thumbnailUrl: string | null;
  photos: { originalUrl: string | null; thumbnailUrl: string }[];
};

// Santiago, Chile
const DEFAULT_CENTER = {
  longitude: -70.6483,
  latitude: -33.4489,
};

type MapViewProps = {
  onMarkerSelect?: (marker: RegisteredPetMarker) => void;
  selectedMarkerId?: number | null;
};

export default function MapView({ onMarkerSelect, selectedMarkerId }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const selectedQueryRef = useRef("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<{
    longitude: number;
    latitude: number;
  } | null>(null);
  const [registeredMarkers, setRegisteredMarkers] = useState<RegisteredPetMarker[]>([]);

  const hasToken = MAPBOX_TOKEN.length > 0;

  const fetchRegisteredMarkers = useCallback(async () => {
    const map = mapRef.current;
    const bounds = map?.getBounds();
    if (!bounds) {
      return;
    }

    const params = new URLSearchParams({
      minLongitude: String(bounds.getWest()),
      maxLongitude: String(bounds.getEast()),
      minLatitude: String(bounds.getSouth()),
      maxLatitude: String(bounds.getNorth()),
    });

    const response = await fetch(`/api/lost-pets-map?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("No se pudieron cargar marcadores.");
    }

    const data = (await response.json()) as { markers?: RegisteredPetMarker[] };
    setRegisteredMarkers(Array.isArray(data.markers) ? data.markers : []);
  }, []);

  const handleLoad = useCallback(() => {
    mapRef.current?.resize();
    void fetchRegisteredMarkers().catch(() => {
      setRegisteredMarkers([]);
    });
  }, [fetchRegisteredMarkers]);

  const getContextValue = useCallback(
    (context: LocationSuggestion["context"], prefix: string) =>
      context?.find((entry) => entry.id.startsWith(`${prefix}.`))?.text ?? null,
    [],
  );

  const mapSelectedAddress = useCallback(
    (result: LocationSuggestion): SelectedAddressDetail => ({
      fullAddress: result.place_name,
      longitude: result.center[0],
      latitude: result.center[1],
      country: getContextValue(result.context, "country"),
      region: getContextValue(result.context, "region"),
      city:
        getContextValue(result.context, "place") ??
        getContextValue(result.context, "locality") ??
        getContextValue(result.context, "district"),
      postcode: getContextValue(result.context, "postcode"),
      street: result.text ?? null,
      houseNumber: result.address ?? null,
    }),
    [getContextValue],
  );

  const emitLocationSelected = useCallback((selected: boolean, address?: SelectedAddressDetail) => {
    window.dispatchEvent(
      new CustomEvent<{ selected: boolean; address?: SelectedAddressDetail }>(
        LOCATION_EVENT_NAME,
        {
          detail: { selected, address },
        },
      ),
    );
  }, []);

  const clearSelection = useCallback(() => {
    emitLocationSelected(false);
    setSelectedPoint(null);
  }, [emitLocationSelected]);

  const handleQueryChange = useCallback((value: string) => {
    if (value !== selectedQueryRef.current) {
      selectedQueryRef.current = "";
      clearSelection();
    }

    setSearchQuery(value);
    setSearchError(null);

    if (!value.trim()) {
      setResults([]);
      clearSelection();
    }
  }, [clearSelection]);

  const fetchSuggestions = useCallback(
    async (query: string, signal: AbortSignal) => {
      if (!hasToken) {
        setSearchError("Falta configurar NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.");
        return;
      }

      const response = await fetch(
        `${GEOCODE_ENDPOINT}/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5&language=es&types=address,place,locality,region,postcode`,
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
    emitLocationSelected(true, mapSelectedAddress(result));
    const map = mapRef.current;

    if (map) {
      const currentZoom = map.getZoom();
      map.jumpTo({
        center: [longitude, latitude],
        zoom: currentZoom > SELECT_ZOOM ? currentZoom : SELECT_ZOOM,
      });
    }
  }, [emitLocationSelected, mapSelectedAddress]);

  const searchAndSelect = useCallback(
    async (query: string) => {
      if (!hasToken) {
        setSearchError("Falta configurar NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.");
        return;
      }

      const response = await fetch(
        `${GEOCODE_ENDPOINT}/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=1&language=es&types=address,place,locality,region,postcode`,
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

  useEffect(() => {
    const handleAutoselectRequest = () => {
      const query = searchQuery.trim();

      if (!query) {
        emitLocationSelected(false);
        return;
      }

      if (results[0]) {
        handleSelectResult(results[0]);
        return;
      }

      void searchAndSelect(query).catch(() => {
        setResults([]);
        setSearchError("No se pudo buscar la ubicación.");
        emitLocationSelected(false);
      });
    };

    window.addEventListener(AUTOSELECT_REQUEST_EVENT_NAME, handleAutoselectRequest);

    return () => {
      window.removeEventListener(AUTOSELECT_REQUEST_EVENT_NAME, handleAutoselectRequest);
    };
  }, [emitLocationSelected, handleSelectResult, results, searchAndSelect, searchQuery]);

  useEffect(() => {
    if (!hasToken) {
      return;
    }

    void fetchRegisteredMarkers().catch(() => {
      setRegisteredMarkers([]);
    });
  }, [fetchRegisteredMarkers, hasToken]);

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
        onMoveEnd={() => {
          void fetchRegisteredMarkers().catch(() => {
            setRegisteredMarkers([]);
          });
        }}
        reuseMaps
      >
        {registeredMarkers.map((marker) => (
          <Marker
            key={`${marker.petLossId}-${marker.longitude}-${marker.latitude}`}
            longitude={marker.longitude}
            latitude={marker.latitude}
            anchor="bottom"
          >
            <button
              type="button"
              aria-label={`Ver fotos de ${marker.petName ?? "mascota perdida"}`}
              className="pointer-events-auto flex flex-col items-center bg-transparent p-0"
              onClick={() => onMarkerSelect?.(marker)}
            >
              {marker.thumbnailUrl ? (
                <div
                  className={`mb-1 overflow-hidden rounded-md border-2 bg-white shadow-lg ${
                    selectedMarkerId === marker.petLossId
                      ? "h-14 w-14 border-blue-500 ring-2 ring-blue-300"
                      : "h-12 w-12 border-white"
                  }`}
                >
                  <img
                    src={marker.thumbnailUrl}
                    alt={marker.petName ?? "Mascota perdida"}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <svg
                aria-hidden="true"
                viewBox="0 0 48 64"
                className="h-14 w-10 drop-shadow-lg"
              >
                <path
                  d="M24 2C12.4 2 3 11.4 3 23c0 15.4 21 39 21 39s21-23.6 21-39C45 11.4 35.6 2 24 2Z"
                  fill="#ef4444"
                />
                <circle cx="24" cy="23" r="10" fill="#ffffff" />
                <circle cx="24" cy="23" r="5.5" fill="#ef4444" />
              </svg>
            </button>
          </Marker>
        ))}
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
