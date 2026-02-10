"use client";

import { useEffect, useMemo, useState } from "react";

type CityCompareMetric = {
  city: string;
  complaints_per_10k: number | null;
  avg_urgency: number;
  avg_resolution_hours: number;
};

export default function ComparePage() {
  const [rows, setRows] = useState<CityCompareMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("http://localhost:8000/api/city-compare");
        if (!res.ok) throw new Error("Failed to load comparison data");
        const data = await res.json();
        setRows(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const chartData = useMemo(() => {
    const max = Math.max(
      1,
      ...rows.map((r) => (r.complaints_per_10k ?? 0))
    );
    return rows.map((r) => ({
      ...r,
      width: Math.round(((r.complaints_per_10k ?? 0) / max) * 100),
    }));
  }, [rows]);

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="float-in">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-700">
              CivicLens AI
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Cross-City Comparison
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Compare complaint intensity, urgency, and resolution speed across
              cities.
            </p>
          </div>
        </header>

        {loading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}
        {error && <p className="mt-6 text-sm text-rose-600">{error}</p>}

        {!loading && !error && (
          <section className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-3xl glass p-6">
              <h2 className="text-lg font-semibold">Complaints per 10k</h2>
              <div className="mt-4 space-y-4">
                {chartData.map((row) => (
                  <div key={row.city}>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>{row.city}</span>
                      <span>
                        {row.complaints_per_10k?.toFixed(2) ?? "—"}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400"
                        style={{ width: `${row.width}%` }}
                      />
                    </div>
                  </div>
                ))}
                {chartData.length === 0 && (
                  <p className="text-sm text-slate-500">No data yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl glass p-6">
              <h2 className="text-lg font-semibold">City Metrics</h2>
              <p className="mt-1 text-xs text-slate-500">
                Avg urgency and resolution time.
              </p>
              <div className="mt-4 space-y-3 text-sm">
                {rows.map((row) => (
                  <div
                    key={row.city}
                    className="rounded-2xl border border-white/50 bg-white/70 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{row.city}</span>
                      <span className="text-slate-500">
                        {(row.avg_urgency * 100).toFixed(0)}% urgency
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Avg resolution: {row.avg_resolution_hours.toFixed(1)}h
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {!loading && !error && (
          <section className="mt-8 rounded-3xl glass p-6">
            <h2 className="text-lg font-semibold">Comparison Table</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2">City</th>
                    <th className="py-2">Complaints / 10k</th>
                    <th className="py-2">Avg urgency</th>
                    <th className="py-2">Avg resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.city}>
                      <td className="py-3 font-medium text-slate-900">
                        {row.city}
                      </td>
                      <td className="py-3 text-slate-700">
                        {row.complaints_per_10k?.toFixed(2) ?? "—"}
                      </td>
                      <td className="py-3 text-slate-700">
                        {(row.avg_urgency * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 text-slate-700">
                        {row.avg_resolution_hours.toFixed(1)}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && (
                <p className="mt-4 text-sm text-slate-500">No data yet.</p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
