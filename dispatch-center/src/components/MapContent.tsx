"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { IntelData } from "@/hooks/useMockStream";

// ──── Custom pulsing marker icon ────
const incidentIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:32px;height:32px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(220,38,38,0.2);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="position:absolute;top:4px;left:4px;width:24px;height:24px;border-radius:50%;background:rgba(220,38,38,0.3);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;animation-delay:0.3s;"></div>
      <div style="position:absolute;top:9px;left:9px;width:14px;height:14px;border-radius:50%;background:#dc2626;border:2px solid white;box-shadow:0 0 16px rgba(220,38,38,0.7), 0 2px 4px rgba(0,0,0,0.2);"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// ──── Unit markers for dispatched resources ────
function getUnitIcon(type: string) {
  const colors: Record<string, string> = {
    Fire: "#f97316",
    EMS: "#ef4444",
    Police: "#3b82f6",
    HazMat: "#eab308",
    Special: "#a855f7",
  };
  const color = colors[type] || "#6b7280";

  return L.divIcon({
    className: "",
    html: `
      <div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 8px ${color}90, 0 1px 3px rgba(0,0,0,0.3);"></div>
    `,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

// ──── Map auto-recenter on location change ────
function MapUpdater({ lat, lng, hasLocation }: { lat: number; lng: number; hasLocation: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (hasLocation) {
      map.flyTo([lat, lng], 15, { duration: 1.5 });
    }
  }, [map, lat, lng, hasLocation]);

  return null;
}

// ──── Main Map Component ────
interface MapContentProps {
  intel: IntelData | null;
}

export default function MapContent({ intel }: MapContentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const location = intel?.location;
  const hasLocation = !!(location && location.address !== "PENDING");

  const lat = location?.lat || 40.7128;
  const lng = location?.lng || -74.006;

  // Scatter unit markers around the incident location
  const unitPositions = (intel?.resources || []).map((r, i) => {
    const angle = (i / Math.max(1, (intel?.resources || []).length)) * 2 * Math.PI;
    const dist = r.status === "On Scene" ? 0.001 : (r.eta || 120) * 0.000008;
    return {
      ...r,
      lat: lat + Math.sin(angle) * dist,
      lng: lng + Math.cos(angle) * dist,
    };
  });

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={hasLocation ? 15 : 12}
      ref={mapRef}
      style={{ height: "100%", width: "100%", borderRadius: "0.5rem" }}
      zoomControl={false}
      attributionControl={false}
    >
      {/* CartoDB Voyager — clean, modern map with subtle colors */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />

      <MapUpdater lat={lat} lng={lng} hasLocation={hasLocation} />

      {/* Incident marker */}
      {hasLocation && (
        <>
          <Marker position={[lat, lng]} icon={incidentIcon} />
          {/* Perimeter circle */}
          <Circle
            center={[lat, lng]}
            radius={200}
            pathOptions={{
              color: "#dc2626",
              fillColor: "#dc2626",
              fillOpacity: 0.08,
              weight: 2,
              dashArray: "8 6",
              opacity: 0.6,
            }}
          />
        </>
      )}

      {/* Dispatched unit markers */}
      {hasLocation &&
        unitPositions.map((unit) => (
          <Marker
            key={unit.id}
            position={[unit.lat, unit.lng]}
            icon={getUnitIcon(unit.type)}
          />
        ))}
    </MapContainer>
  );
}
