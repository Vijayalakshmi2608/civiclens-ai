"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

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
const Tooltip = dynamic(
  () => import("react-leaflet").then((mod) => mod.Tooltip),
  { ssr: false }
);

type CityStat = {
  city: string;
  count: number;
  avg_urgency: number;
  categories: string[];
  lat: number | null;
  lng: number | null;
};

type EquityBucket = {
  income_bucket: string;
  complaints_per_10k: number | null;
  unresolved_pct: number;
};

type EquityResponse = {
  service_equity_score: number;
  inequality_index: number;
  buckets: EquityBucket[];
};

function urgencyColor(avgUrgency: number) {
  if (avgUrgency >= 0.7) return "#f43f5e";
  if (avgUrgency >= 0.4) return "#f59e0b";
  return "#10b981";
}

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

export default function DashboardMapPage() {
  const [stats, setStats] = useState<CityStat[]>([]);
  const [equity, setEquity] = useState<EquityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void ensureLeafletIcons();
    async function load() {
      try {
        const [statsRes, equityRes] = await Promise.all([
          fetch("http://localhost:8000/api/city-stats"),
          fetch("http://localhost:8000/api/impact/equity"),
        ]);
        if (!statsRes.ok) throw new Error("Failed to load city stats");
        if (!equityRes.ok) throw new Error("Failed to load equity metrics");
        const statsData = await statsRes.json();
        const equityData = await equityRes.json();
        setStats(statsData);
        setEquity(equityData);
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
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="float-in">
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
          <div className="glass card-3d rounded-2xl px-4 py-3">
            <p className="text-xs font-medium text-slate-500">Cities plotted</p>
            <p className="text-2xl font-semibold">{stats.length}</p>
          </div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl glass p-4">
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

          <div className="rounded-3xl glass p-6">
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

            {equity && (
              <div className="mt-6 rounded-2xl border border-white/60 bg-white/80 p-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Service Equity Score</span>
                  <span>{equity.service_equity_score.toFixed(1)}</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400"
                    style={{
                      width: `${Math.min(100, equity.service_equity_score)}%`,
                    }}
                  />
                </div>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  {equity.buckets.map((bucket) => (
                    <div key={bucket.income_bucket} className="flex justify-between">
                      <span>{bucket.income_bucket}</span>
                      <span>
                        {bucket.complaints_per_10k?.toFixed(2) ?? "—"} /10k ·{" "}
                        {bucket.unresolved_pct.toFixed(1)}% unresolved
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
