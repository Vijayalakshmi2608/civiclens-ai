"use client";

import { useEffect, useMemo, useState } from "react";

type Complaint = {
  category: string;
  department: string;
  city: string;
  timestamp: string;
  description: string;
  urgency_score: number;
};

type UrgencyBucket = "Low" | "Medium" | "High";

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

export default function DashboardPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cityFilter, setCityFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("http://localhost:8000/api/complaints");
        if (!res.ok) throw new Error("Failed to load complaints");
        const data = await res.json();
        setComplaints(data);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
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
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Total complaints</p>
              <p className="text-2xl font-semibold">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Avg response time</p>
              <p className="text-2xl font-semibold">
                {formatHours(stats.avgResponseTimeHours)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-slate-500">High urgency cases</p>
              <p className="text-2xl font-semibold">{stats.highUrgency}</p>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              City
            </label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
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
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
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
          <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
                          className="h-2 rounded-full bg-emerald-400"
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

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Urgency Distribution</h2>
              <div className="mt-4 grid gap-3 text-sm">
                {(["High", "Medium", "Low"] as UrgencyBucket[]).map((bucket) => {
                  const value = urgencyDistribution[bucket];
                  const total = filtered.length || 1;
                  const pct = Math.round((value / total) * 100);
                  return (
                    <div key={bucket} className="rounded-2xl border border-slate-100 p-3">
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
          </div>
        </section>
      </div>
    </div>
  );
}
