"use client";

import { useRef, useCallback } from "react";
import Map, { NavigationControl, GeolocateControl } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

// Santiago, Chile
const DEFAULT_CENTER = {
  longitude: -70.6483,
  latitude: -33.4489,
};

export default function MapView() {
  const mapRef = useRef<MapRef>(null);

  const handleLoad = useCallback(() => {
    mapRef.current?.resize();
  }, []);

  return (
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
      <NavigationControl position="top-right" />
      <GeolocateControl position="top-right" trackUserLocation />
    </Map>
  );
}
