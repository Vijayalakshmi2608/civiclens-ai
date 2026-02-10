"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker),
  { ssr: false }
);

type RiskZone = {
  zone_id: string;
  risk_score: number;
  predicted_issue_types: string[];
};

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "New York City": { lat: 40.7128, lng: -74.006 },
  "San Francisco": { lat: 37.7749, lng: -122.4194 },
  Chicago: { lat: 41.8781, lng: -87.6298 },
  Boston: { lat: 42.3601, lng: -71.0589 },
};

async function ensureLeafletIcons() {
  const L = (await import("leaflet")).default;
  const iconUrl =
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
  const iconRetinaUrl =
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
  const shadowUrl =
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

  L.Icon.Default.mergeOptions({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
  });
}

export default function RiskZonesPage() {
  const [zones, setZones] = useState<RiskZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void ensureLeafletIcons();
    async function load() {
      try {
        const res = await fetch("http://localhost:8000/api/predict-risk-zones");
        if (!res.ok) throw new Error("Failed to load risk zones");
        const data = await res.json();
        setZones(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="float-in">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-700">
            CivicLens AI
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Risk Zone Forecast
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Predict high-risk zones using 90-day trends, weather, and density data.
          </p>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl glass p-4">
            {loading && <p className="text-sm text-slate-500">Loading map...</p>}
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {!loading && !error && (
              <MapContainer
                center={[39.5, -98.35]}
                zoom={4}
                scrollWheelZoom={false}
                className="h-[480px] w-full rounded-2xl"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {zones.map((zone) => {
                  const coords = CITY_COORDS[zone.zone_id];
                  if (!coords) return null;
                  const radius = Math.min(28, 8 + zone.risk_score / 5);
                  return (
                    <CircleMarker
                      key={zone.zone_id}
                      center={[coords.lat, coords.lng]}
                      radius={radius}
                      pathOptions={{
                        color: "#f97316",
                        fillColor: "#f97316",
                        fillOpacity: 0.45,
                      }}
                    />
                  );
                })}
              </MapContainer>
            )}
          </div>

          <div className="rounded-3xl glass p-6">
            <h2 className="text-lg font-semibold">Top Risk Zones</h2>
            <div className="mt-4 space-y-3 text-sm">
              {zones.map((zone) => (
                <div
                  key={zone.zone_id}
                  className="rounded-2xl border border-white/60 bg-white/80 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{zone.zone_id}</span>
                    <span className="text-slate-500">
                      {zone.risk_score.toFixed(1)}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Issues: {zone.predicted_issue_types.join(", ") || "—"}
                  </div>
                </div>
              ))}
              {zones.length === 0 && (
                <p className="text-sm text-slate-500">No risk zones yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
