"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import L from "leaflet";

type CityStat = {
  city: string;
  count: number;
  avg_urgency: number;
  categories: string[];
  lat: number | null;
  lng: number | null;
};

function urgencyColor(avgUrgency: number) {
  if (avgUrgency >= 0.7) return "#f43f5e";
  if (avgUrgency >= 0.4) return "#f59e0b";
  return "#10b981";
}

function ensureLeafletIcons() {
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

export default function DashboardMapPage() {
  const [stats, setStats] = useState<CityStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureLeafletIcons();
    async function load() {
      try {
        const res = await fetch("http://localhost:8000/api/city-stats");
        if (!res.ok) throw new Error("Failed to load city stats");
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const points = useMemo(
    () => stats.filter((s) => s.lat !== null && s.lng !== null),
    [stats]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
              CivicLens AI
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              City Heatmap
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Visualize complaint volume by city. Color intensity reflects urgency.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Cities plotted</p>
            <p className="text-2xl font-semibold">{stats.length}</p>
          </div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            {loading && <p className="text-sm text-slate-500">Loading map…</p>}
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
                {points.map((point) => {
                  const radius = Math.min(30, 8 + point.count * 4);
                  return (
                    <CircleMarker
                      key={point.city}
                      center={[point.lat as number, point.lng as number]}
                      radius={radius}
                      pathOptions={{
                        color: urgencyColor(point.avg_urgency),
                        fillColor: urgencyColor(point.avg_urgency),
                        fillOpacity: 0.65,
                      }}
                    >
                      <Tooltip>
                        <div className="text-xs">
                          <strong>{point.city}</strong>
                          <div>{point.count} complaints</div>
                          <div>
                            Avg urgency: {(point.avg_urgency * 100).toFixed(0)}%
                          </div>
                          <div>Categories: {point.categories.join(", ")}</div>
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">City Breakdown</h2>
            <p className="mt-1 text-xs text-slate-500">
              Counts and urgency by city (map uses these values).
            </p>
            <div className="mt-4 space-y-3 text-sm">
              {stats.map((stat) => (
                <div
                  key={stat.city}
                  className="rounded-2xl border border-slate-100 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{stat.city}</span>
                    <span className="text-slate-500">{stat.count} total</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Avg urgency</span>
                    <span>{(stat.avg_urgency * 100).toFixed(0)}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${Math.round(stat.avg_urgency * 100)}%`,
                        backgroundColor: urgencyColor(stat.avg_urgency),
                      }}
                    />
                  </div>
                </div>
              ))}
              {stats.length === 0 && (
                <p className="text-sm text-slate-500">No complaint data yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
