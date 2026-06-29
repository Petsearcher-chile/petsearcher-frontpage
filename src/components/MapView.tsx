"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
  Marker,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl/mapbox";
import type { GeolocateControlInstance, MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
const GEOCODE_ENDPOINT = "https://api.mapbox.com/geocoding/v5/mapbox.places";
const SELECT_ZOOM = 16;
const DEFAULT_ZOOM = 12;
const LOCATION_EVENT_NAME = "petsearcher:location-selected";
const AUTOSELECT_REQUEST_EVENT_NAME = "petsearcher:location-autoselect-request";
const LATITUDE_PARAM_NAME = "lat";
const LONGITUDE_PARAM_NAME = "lng";

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

type SelectedPoint = {
  longitude: number;
  latitude: number;
};

export type RegisteredPetMarker = {
  markerType: "lost" | "found";
  markerId: number;
  longitude: number;
  latitude: number;
  fullAddress: string;
  petName: string | null;
  lostPetDate: string | null;
  thumbnailUrl: string | null;
  photos: { originalUrl: string | null; thumbnailUrl: string; nanoUrl: string }[];
};

// Santiago, Chile
const DEFAULT_CENTER = {
  longitude: -70.6483,
  latitude: -33.4489,
};

const parsePointFromSearchParams = (searchParams: URLSearchParams): SelectedPoint | null => {
  const rawLatitude = searchParams.get(LATITUDE_PARAM_NAME);
  const rawLongitude = searchParams.get(LONGITUDE_PARAM_NAME);

  if (!rawLatitude || !rawLongitude) {
    return null;
  }

  const latitudeValue = Number(rawLatitude);
  const longitudeValue = Number(rawLongitude);
  const hasInvalidNumber = !Number.isFinite(latitudeValue) || !Number.isFinite(longitudeValue);
  const hasInvalidRange =
    latitudeValue < -90 || latitudeValue > 90 || longitudeValue < -180 || longitudeValue > 180;
  if (hasInvalidNumber || hasInvalidRange) {
    return null;
  }

  return {
    latitude: latitudeValue,
    longitude: longitudeValue,
  };
};

type MapViewProps = {
  onMarkerSelect?: (marker: RegisteredPetMarker) => void;
  selectedMarkerId?: number | null;
  selectedMarkerType?: "lost" | "found" | null;
  activePetForm?: "lost" | "found" | null;
};

export default function MapView({
  onMarkerSelect,
  selectedMarkerId,
  selectedMarkerType,
  activePetForm,
}: MapViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const mapRef = useRef<MapRef>(null);
  const isMapLoadedRef = useRef(false);
  const pendingCenterPointRef = useRef<SelectedPoint | null>(null);
  const geolocateControlRef = useRef<GeolocateControlInstance | null>(null);
  const geolocateTriggeredRef = useRef(false);
  const selectedQueryRef = useRef("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return parsePointFromSearchParams(new URLSearchParams(window.location.search));
  });
  const [registeredMarkers, setRegisteredMarkers] = useState<RegisteredPetMarker[]>([]);
  const selectedPinColor = activePetForm === "found" ? "#3b82f6" : "#ef4444";
  const initialMapCenter = selectedPoint ?? DEFAULT_CENTER;

  const hasToken = MAPBOX_TOKEN.length > 0;

  const updatePointInUrl = useCallback(
    (point: SelectedPoint | null) => {
      const params = new URLSearchParams(window.location.search);
      if (point) {
        params.set(LATITUDE_PARAM_NAME, String(point.latitude));
        params.set(LONGITUDE_PARAM_NAME, String(point.longitude));
      } else {
        params.delete(LATITUDE_PARAM_NAME);
        params.delete(LONGITUDE_PARAM_NAME);
      }

      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    },
    [pathname, router],
  );

  const centerMapOnPoint = useCallback((point: SelectedPoint) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const currentZoom = map.getZoom();
    map.jumpTo({
      center: [point.longitude, point.latitude],
      zoom: currentZoom > SELECT_ZOOM ? currentZoom : SELECT_ZOOM,
    });
  }, []);

  const applyInitialUserPoint = useCallback(
    (point: SelectedPoint) => {
      if (selectedPoint !== null) {
        return;
      }

      if (parsePointFromSearchParams(new URLSearchParams(window.location.search)) !== null) {
        return;
      }

      setSelectedPoint(point);
      updatePointInUrl(point);
      if (isMapLoadedRef.current) {
        centerMapOnPoint(point);
      } else {
        pendingCenterPointRef.current = point;
      }
    },
    [centerMapOnPoint, selectedPoint, updatePointInUrl],
  );

  const handleGeolocateResult = useCallback(
    (event: { coords?: { longitude?: number; latitude?: number } }) => {
      const longitude = event.coords?.longitude;
      const latitude = event.coords?.latitude;
      if (typeof longitude !== "number" || typeof latitude !== "number") {
        return;
      }

      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return;
      }

      const userPoint = { longitude, latitude };
      applyInitialUserPoint(userPoint);
    },
    [applyInitialUserPoint],
  );

  useEffect(() => {
    if (selectedPoint !== null) {
      return;
    }

    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyInitialUserPoint({
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [applyInitialUserPoint, selectedPoint]);

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
    isMapLoadedRef.current = true;
    mapRef.current?.resize();
    const pointToCenter = selectedPoint ?? pendingCenterPointRef.current;
    if (pointToCenter) {
      centerMapOnPoint(pointToCenter);
      pendingCenterPointRef.current = null;
    } else if (!geolocateTriggeredRef.current) {
      geolocateTriggeredRef.current = true;
      geolocateControlRef.current?.trigger();
    }
    void fetchRegisteredMarkers().catch(() => {
      setRegisteredMarkers([]);
    });
  }, [centerMapOnPoint, fetchRegisteredMarkers, selectedPoint]);

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
    updatePointInUrl(null);
  }, [emitLocationSelected, updatePointInUrl]);

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

    const point = { longitude, latitude };
    setSelectedPoint(point);
    updatePointInUrl(point);
    emitLocationSelected(true, mapSelectedAddress(result));
    centerMapOnPoint(point);
  }, [centerMapOnPoint, emitLocationSelected, mapSelectedAddress, updatePointInUrl]);

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
          ...initialMapCenter,
          zoom: selectedPoint ? SELECT_ZOOM : DEFAULT_ZOOM,
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
            key={`${marker.markerType}-${marker.markerId}-${marker.longitude}-${marker.latitude}`}
            longitude={marker.longitude}
            latitude={marker.latitude}
            anchor="bottom"
          >
            <button
              type="button"
              aria-label={`Ver ${marker.markerType === "found" ? "mascota encontrada" : "mascota perdida"}`}
              className="pointer-events-auto flex flex-col items-center bg-transparent p-0"
              onClick={() => onMarkerSelect?.(marker)}
            >
              {marker.thumbnailUrl ? (
                <div
                  className={`mb-1 overflow-hidden rounded-md border-2 bg-white shadow-lg ${
                    selectedMarkerId === marker.markerId && selectedMarkerType === marker.markerType
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
                  fill={marker.markerType === "found" ? "#3b82f6" : "#ef4444"}
                />
                <circle cx="24" cy="23" r="10" fill="#ffffff" />
                <circle
                  cx="24"
                  cy="23"
                  r="5.5"
                  fill={marker.markerType === "found" ? "#3b82f6" : "#ef4444"}
                />
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
                fill={selectedPinColor}
              />
              <circle cx="24" cy="23" r="10" fill="#ffffff" />
              <circle cx="24" cy="23" r="5.5" fill={selectedPinColor} />
            </svg>
          </Marker>
        ) : null}
        <NavigationControl position="top-right" />
        <GeolocateControl
          ref={geolocateControlRef}
          position="top-right"
          trackUserLocation={false}
          onGeolocate={handleGeolocateResult}
        />
      </Map>
    </div>
  );
}
