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

type CityReportResponse = {
  key_issues: string[];
  root_causes: string[];
  recommended_actions: string[];
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

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState("New York City");
  const [report, setReport] = useState<CityReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [deptCoaching, setDeptCoaching] = useState<DepartmentCoachingResponse[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);

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
    async function loadCoaching() {
      try {
        const res = await fetch("http://localhost:8000/api/department-coaching");
        if (!res.ok) throw new Error("Failed to load coaching reports");
        const payload = await res.json();
        setDeptCoaching(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setDeptLoading(false);
      }
    }
    load();
    loadCoaching();
  }, []);

  async function handleGenerateReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setReport(null);
    setReportLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/ai/city-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city }),
      });
      if (!res.ok) throw new Error("Failed to generate report");
      const payload = await res.json();
      setReport(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setReportLoading(false);
    }
  }

  async function handleLoadCoaching() {
    setDeptLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/department-coaching");
      if (!res.ok) throw new Error("Failed to load coaching reports");
      const payload = await res.json();
      setDeptCoaching(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeptLoading(false);
    }
  }

  const departments = useMemo(() => {
    return data?.departments
      ? [...data.departments].sort(
          (a, b) => a.avg_resolution_hours - b.avg_resolution_hours
        )
      : [];
  }, [data]);

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="float-in">
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

            <section className="mt-8 rounded-3xl glass p-6">
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

            <section className="mt-8 rounded-3xl glass p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">AI Executive Summary</h2>
                <span className="text-xs text-slate-500">City-level report</span>
              </div>

              <form onSubmit={handleGenerateReport} className="mt-4 flex flex-wrap gap-3">
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City name"
                  className="flex-1 rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
                <button
                  type="submit"
                  disabled={reportLoading}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {reportLoading ? "Generating…" : "Generate Report"}
                </button>
              </form>

              {report && (
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/60 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Key Issues
                    </p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-700">
                      {report.key_issues.map((item, idx) => (
                        <li key={`issue-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-white/60 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Root Causes
                    </p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-700">
                      {report.root_causes.map((item, idx) => (
                        <li key={`cause-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-white/60 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Recommended Actions
                    </p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-700">
                      {report.recommended_actions.map((item, idx) => (
                        <li key={`action-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>

            <section className="mt-8 rounded-3xl glass p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Department Coaching</h2>
                <button
                  onClick={handleLoadCoaching}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={deptLoading}
                >
                  {deptLoading ? "Loading…" : "Generate Coaching"}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                AI-generated strengths, weaknesses, and action plans per department.
              </p>

              <div className="mt-4 space-y-4">
                {deptCoaching.map((item) => (
                  <div
                    key={item.department_name}
                    className="rounded-2xl border border-white/60 bg-white/80 p-4"
                  >
                    <div className="text-sm font-semibold text-slate-800">
                      {item.department_name}
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="text-sm">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Strengths
                        </p>
                        <ul className="mt-2 space-y-2 text-slate-700">
                          {item.coaching_report.strengths.map((val, idx) => (
                            <li key={`s-${idx}`}>{val}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="text-sm">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Weaknesses
                        </p>
                        <ul className="mt-2 space-y-2 text-slate-700">
                          {item.coaching_report.weaknesses.map((val, idx) => (
                            <li key={`w-${idx}`}>{val}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="text-sm">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Priority Fixes
                        </p>
                        <ul className="mt-2 space-y-2 text-slate-700">
                          {item.coaching_report.priority_fixes.map((val, idx) => (
                            <li key={`p-${idx}`}>{val}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="text-sm">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Process Improvements
                        </p>
                        <ul className="mt-2 space-y-2 text-slate-700">
                          {item.coaching_report.process_improvements.map(
                            (val, idx) => (
                              <li key={`i-${idx}`}>{val}</li>
                            )
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
                {!deptLoading && deptCoaching.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Click “Generate Coaching” to load department reports.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
