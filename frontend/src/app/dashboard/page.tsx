"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

type Complaint = {
  category: string;
  department: string;
  city: string;
  timestamp: string;
  description: string;
  urgency_score: number;
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

type RiskZone = {
  zone_id: string;
  risk_score: number;
  predicted_issue_types: string[];
};

type RootCauseCluster = {
  cluster_id: number;
  root_cause_summary: string;
  top_keywords: string[];
  affected_departments: string[];
  example_complaints: string[];
};

type DepartmentCoachingReport = {
  strengths: string[];
  weaknesses: string[];
  priority_fixes: string[];
  process_improvements: string[];
};

type DepartmentCoachingResponse = {
  department_name: string;
  coaching_report: DepartmentCoachingReport;
};

type TrustScore = {
  department: string;
  trust_score: number;
  metric_breakdown: {
    avg_response_time: number;
    resolution_rate: number;
    sentiment_score: number;
    repeat_complaint_ratio: number;
  };
};

type VoiceResponse = {
  original_text: string;
  translated_text: string;
  category: string;
  urgency_score: number;
};

type UrgencyBucket = "Low" | "Medium" | "High";

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "New York City": { lat: 40.7128, lng: -74.006 },
  "San Francisco": { lat: 37.7749, lng: -122.4194 },
  Chicago: { lat: 41.8781, lng: -87.6298 },
  Boston: { lat: 42.3601, lng: -71.0589 },
};

function formatHours(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}h`;
}

function mapUrgencyToBucket(score: number): UrgencyBucket {
  if (score >= 0.7) return "High";
  if (score >= 0.4) return "Medium";
  return "Low";
}

function mapUrgencyToStatus(score: number) {
  if (score >= 0.7) return "Escalated";
  if (score >= 0.4) return "In Review";
  return "Queued";
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

function urgencyColor(avgUrgency: number) {
  if (avgUrgency >= 0.7) return "#f43f5e";
  if (avgUrgency >= 0.4) return "#f59e0b";
  return "#10b981";
}

export default function DashboardPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [equity, setEquity] = useState<EquityResponse | null>(null);
  const [riskZones, setRiskZones] = useState<RiskZone[]>([]);
  const [rootCause, setRootCause] = useState<RootCauseCluster[]>([]);
  const [rootCity, setRootCity] = useState("New York City");
  const [rootDays, setRootDays] = useState(14);
  const [rootLoading, setRootLoading] = useState(false);
  const [deptCoaching, setDeptCoaching] = useState<DepartmentCoachingResponse[]>([]);
  const [trustScores, setTrustScores] = useState<TrustScore[]>([]);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceResult, setVoiceResult] = useState<VoiceResponse | null>(null);

  const [cityFilter, setCityFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  useEffect(() => {
    async function load() {
      try {
        void ensureLeafletIcons();
        const [
          complaintsRes,
          equityRes,
          riskRes,
          coachingRes,
          trustRes,
        ] = await Promise.all([
          fetch("http://localhost:8000/api/complaints"),
          fetch("http://localhost:8000/api/impact/equity"),
          fetch("http://localhost:8000/api/predict-risk-zones"),
          fetch("http://localhost:8000/api/department-coaching"),
          fetch("http://localhost:8000/api/trust-scores"),
        ]);
        if (!complaintsRes.ok) throw new Error("Failed to load complaints");
        if (!equityRes.ok) throw new Error("Failed to load equity metrics");
        if (!riskRes.ok) throw new Error("Failed to load risk zones");
        if (!coachingRes.ok) throw new Error("Failed to load coaching reports");
        if (!trustRes.ok) throw new Error("Failed to load trust scores");
        const complaintsData = await complaintsRes.json();
        const equityData = await equityRes.json();
        const riskData = await riskRes.json();
        const coachingData = await coachingRes.json();
        const trustData = await trustRes.json();
        setComplaints(complaintsData);
        setEquity(equityData);
        setRiskZones(riskData);
        setDeptCoaching(coachingData);
        setTrustScores(trustData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cities = useMemo(() => {
    return ["All", ...Array.from(new Set(complaints.map((c) => c.city))).sort()];
  }, [complaints]);

  const categories = useMemo(() => {
    return [
      "All",
      ...Array.from(new Set(complaints.map((c) => c.category))).sort(),
    ];
  }, [complaints]);

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      if (cityFilter !== "All" && c.city !== cityFilter) return false;
      if (categoryFilter !== "All" && c.category !== categoryFilter) return false;
      return true;
    });
  }, [complaints, cityFilter, categoryFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const highUrgency = filtered.filter((c) => c.urgency_score >= 0.7).length;
    const avgResponseTimeHours =
      total === 0
        ? NaN
        : filtered.reduce((acc, c) => acc + (1.2 + (1 - c.urgency_score) * 6), 0) /
          total;
    return { total, highUrgency, avgResponseTimeHours };
  }, [filtered]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((c) => counts.set(c.category, (counts.get(c.category) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const urgencyDistribution = useMemo(() => {
    const buckets: Record<UrgencyBucket, number> = { Low: 0, Medium: 0, High: 0 };
    filtered.forEach((c) => {
      buckets[mapUrgencyToBucket(c.urgency_score)] += 1;
    });
    return buckets;
  }, [filtered]);

  async function loadRootCause() {
    setRootLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/root-cause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: rootCity, days: rootDays }),
      });
      if (!res.ok) throw new Error("Failed to load root cause clusters");
      const data = await res.json();
      setRootCause(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRootLoading(false);
    }
  }

  async function handleVoiceSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!voiceFile) return;
    setVoiceLoading(true);
    setVoiceResult(null);
    try {
      const form = new FormData();
      form.append("audio_file", voiceFile);
      const res = await fetch("http://localhost:8000/api/voice-ingest", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Failed to process voice complaint");
      const data = await res.json();
      setVoiceResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setVoiceLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="float-in">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
              CivicLens AI
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Operations Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Track incoming complaints, triage urgency, and monitor category trends
              across departments.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="glass card-3d rounded-2xl px-5 py-4">
              <p className="text-xs font-medium text-slate-500">Total complaints</p>
              <p className="text-2xl font-semibold">{stats.total}</p>
            </div>
            <div className="glass card-3d rounded-2xl px-5 py-4">
              <p className="text-xs font-medium text-slate-500">Avg response time</p>
              <p className="text-2xl font-semibold">
                {formatHours(stats.avgResponseTimeHours)}
              </p>
            </div>
            <div className="glass card-3d rounded-2xl px-5 py-4">
              <p className="text-xs font-medium text-slate-500">High urgency cases</p>
              <p className="text-2xl font-semibold">{stats.highUrgency}</p>
            </div>
            {equity && (
              <>
                <div className="glass card-3d rounded-2xl px-5 py-4">
                  <p className="text-xs font-medium text-slate-500">
                    Service Equity Score
                  </p>
                  <p className="text-2xl font-semibold">
                    {equity.service_equity_score.toFixed(1)}
                  </p>
                </div>
                <div className="glass card-3d rounded-2xl px-5 py-4">
                  <p className="text-xs font-medium text-slate-500">
                    Inequality Index
                  </p>
                  <p className="text-2xl font-semibold">
                    {equity.inequality_index.toFixed(1)}
                  </p>
                </div>
              </>
            )}
          </div>
        </header>

        <section className="mt-8 grid gap-4 rounded-3xl glass p-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              City
            </label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl glass p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Complaints Table</h2>
              <span className="text-xs text-slate-500">Filtered view</span>
            </div>

            {loading && <p className="mt-4 text-sm text-slate-500">Loading data…</p>}
            {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

            {!loading && !error && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2">City</th>
                      <th className="py-2">Category</th>
                      <th className="py-2">Department</th>
                      <th className="py-2">Urgency</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((c, idx) => (
                      <tr key={`${c.city}-${idx}`} className="align-top">
                        <td className="py-3 font-medium text-slate-900">{c.city}</td>
                        <td className="py-3 text-slate-700">{c.category}</td>
                        <td className="py-3 text-slate-700">{c.department}</td>
                        <td className="py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              c.urgency_score >= 0.7
                                ? "bg-rose-100 text-rose-700"
                                : c.urgency_score >= 0.4
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {(c.urgency_score * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-3 text-slate-700">
                          {mapUrgencyToStatus(c.urgency_score)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <p className="mt-4 text-sm text-slate-500">No results.</p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-6">
            <div className="rounded-3xl glass p-6">
              <h2 className="text-lg font-semibold">Complaints by Category</h2>
              <div className="mt-4 space-y-3">
                {categoryCounts.map(([category, count]) => {
                  const max = Math.max(1, ...categoryCounts.map(([, v]) => v));
                  const width = Math.round((count / max) * 100);
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>{category}</span>
                        <span>{count}</span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {categoryCounts.length === 0 && (
                  <p className="text-sm text-slate-500">No data yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl glass p-6">
              <h2 className="text-lg font-semibold">Urgency Distribution</h2>
              <div className="mt-4 grid gap-3 text-sm">
                {(["High", "Medium", "Low"] as UrgencyBucket[]).map((bucket) => {
                  const value = urgencyDistribution[bucket];
                  const total = filtered.length || 1;
                  const pct = Math.round((value / total) * 100);
                  return (
                    <div key={bucket} className="rounded-2xl border border-white/50 bg-white/70 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{bucket}</span>
                        <span className="text-slate-500">{value} cases</span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                        <div
                          className={`h-2 rounded-full ${
                            bucket === "High"
                              ? "bg-rose-400"
                              : bucket === "Medium"
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {equity && (
              <div className="rounded-3xl glass p-6">
                <h2 className="text-lg font-semibold">Equity Lens</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Complaints per 10k and unresolved rate by income group.
                </p>
                <div className="mt-4 space-y-3 text-sm">
                  {equity.buckets.map((bucket) => (
                    <div
                      key={bucket.income_bucket}
                      className="rounded-2xl border border-white/50 bg-white/70 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{bucket.income_bucket}</span>
                        <span className="text-slate-500">
                          {bucket.complaints_per_10k?.toFixed(2) ?? "—"} /10k
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Unresolved: {bucket.unresolved_pct.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-3xl glass p-6">
              <h2 className="text-lg font-semibold">Risk Zones</h2>
              <p className="mt-1 text-xs text-slate-500">
                Predicted high-risk zones from 90-day trends.
              </p>
              <div className="mt-4 space-y-3 text-sm">
                {riskZones.map((zone) => (
                  <div
                    key={zone.zone_id}
                    className="rounded-2xl border border-white/50 bg-white/70 p-3"
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
                {riskZones.length === 0 && (
                  <p className="text-sm text-slate-500">No risk data yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Root Cause Explorer</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    loadRootCause();
                  }}
                  className="flex flex-wrap gap-3"
                >
                  <input
                    value={rootCity}
                    onChange={(e) => setRootCity(e.target.value)}
                    placeholder="City"
                    className="flex-1 rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    value={rootDays}
                    onChange={(e) => setRootDays(Number(e.target.value))}
                    className="w-24 rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    disabled={rootLoading}
                  >
                    {rootLoading ? "Loading…" : "Run"}
                  </button>
                </form>
                <div className="mt-4 space-y-3">
                  {rootCause.map((cluster) => (
                    <div
                      key={cluster.cluster_id}
                      className="rounded-2xl border border-white/60 bg-white/80 p-3"
                    >
                      <div className="text-xs font-semibold text-slate-500">
                        Cluster {cluster.cluster_id}
                      </div>
                      <div className="mt-1 text-sm">{cluster.root_cause_summary}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        Keywords: {cluster.top_keywords.join(", ")}
                      </div>
                    </div>
                  ))}
                  {rootCause.length === 0 && (
                    <p className="text-sm text-slate-500">
                      Run to generate clustered root causes.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Risk Zone Map</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56 w-full overflow-hidden rounded-2xl">
                  <MapContainer
                    center={[39.5, -98.35]}
                    zoom={4}
                    scrollWheelZoom={false}
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {riskZones.map((zone) => {
                      const coords = CITY_COORDS[zone.zone_id];
                      if (!coords) return null;
                      return (
                        <CircleMarker
                          key={zone.zone_id}
                          center={[coords.lat, coords.lng]}
                          radius={Math.min(28, 8 + zone.risk_score / 5)}
                          pathOptions={{
                            color: "#f97316",
                            fillColor: "#f97316",
                            fillOpacity: 0.45,
                          }}
                        />
                      );
                    })}
                  </MapContainer>
                </div>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  {riskZones.slice(0, 5).map((zone) => (
                    <div key={zone.zone_id} className="flex justify-between">
                      <span>{zone.zone_id}</span>
                      <span>{zone.risk_score.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Department Coaching Panel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deptCoaching.slice(0, 3).map((dept) => (
                    <div
                      key={dept.department_name}
                      className="rounded-2xl border border-white/60 bg-white/80 p-3"
                    >
                      <div className="text-sm font-semibold">
                        {dept.department_name}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {dept.coaching_report.priority_fixes.join(" · ")}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Voice Complaint Upload</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVoiceSubmit} className="flex flex-col gap-3">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setVoiceFile(e.target.files?.[0] ?? null)}
                    className="rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    disabled={!voiceFile || voiceLoading}
                  >
                    {voiceLoading ? "Processing…" : "Upload & Analyze"}
                  </button>
                </form>
                {voiceResult && (
                  <div className="mt-3 text-xs text-slate-600">
                    {voiceResult.category} · Urgency {voiceResult.urgency_score}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Trust Score Leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trustScores.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="department" hide />
                      <YAxis />
                      <RechartsTooltip />
                      <Bar dataKey="trust_score" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
