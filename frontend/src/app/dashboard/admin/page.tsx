"use client";

import { useEffect, useMemo, useState } from "react";

type DepartmentMetric = {
  department: string;
  avg_resolution_hours: number;
  unresolved_cases: number;
};

type AlertsPayload = {
  high_urgency_24h: number;
  threshold: number;
  triggered: boolean;
};

type AdminAnalyticsResponse = {
  departments: DepartmentMetric[];
  alerts: AlertsPayload;
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("http://localhost:8000/api/admin-analytics");
        if (!res.ok) throw new Error("Failed to load analytics");
        const payload = await res.json();
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const departments = useMemo(() => {
    return data?.departments
      ? [...data.departments].sort(
          (a, b) => a.avg_resolution_hours - b.avg_resolution_hours
        )
      : [];
  }, [data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
              CivicLens AI
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Admin Analytics Panel
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Department performance and automated AI alerts.
            </p>
          </div>
        </header>

        {loading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}
        {error && <p className="mt-6 text-sm text-rose-600">{error}</p>}

        {!loading && !error && data && (
          <>
            <section className="mt-6">
              <div
                className={`rounded-3xl border px-6 py-4 shadow-sm ${
                  data.alerts.triggered
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900"
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider">
                      AI Alert
                    </p>
                    <p className="text-sm">
                      {data.alerts.high_urgency_24h} high-urgency complaints in
                      the last 24 hours.
                    </p>
                  </div>
                  <div className="text-sm font-semibold">
                    Threshold: {data.alerts.threshold}
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Department Leaderboard</h2>
                <span className="text-xs text-slate-500">
                  Avg resolution time (simulated)
                </span>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2">Department</th>
                      <th className="py-2">Avg resolution time</th>
                      <th className="py-2">Unresolved cases</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {departments.map((dept) => (
                      <tr key={dept.department}>
                        <td className="py-3 font-medium text-slate-900">
                          {dept.department}
                        </td>
                        <td className="py-3 text-slate-700">
                          {dept.avg_resolution_hours.toFixed(1)}h
                        </td>
                        <td className="py-3 text-slate-700">
                          {dept.unresolved_cases}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {departments.length === 0 && (
                  <p className="mt-4 text-sm text-slate-500">No data yet.</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
