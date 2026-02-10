"use client";

import { useState } from "react";

type RootCauseCluster = {
  cluster_id: number;
  root_cause_summary: string;
  top_keywords: string[];
  affected_departments: string[];
  example_complaints: string[];
};

export default function RootCausePage() {
  const [city, setCity] = useState("New York City");
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clusters, setClusters] = useState<RootCauseCluster[]>([]);

  async function loadClusters(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/api/root-cause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, days }),
      });
      if (!res.ok) throw new Error("Failed to load root causes");
      const data = await res.json();
      setClusters(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="float-in">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-700">
            CivicLens AI
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Root Cause Explorer
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Cluster complaints to reveal underlying causes and patterns.
          </p>
        </header>

        <section className="mt-8 rounded-3xl glass p-6">
          <form onSubmit={loadClusters} className="flex flex-wrap gap-3">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="flex-1 rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-24 rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              disabled={loading}
            >
              {loading ? "Loading..." : "Run"}
            </button>
          </form>

          {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {clusters.map((cluster) => (
              <div
                key={cluster.cluster_id}
                className="rounded-2xl border border-white/60 bg-white/80 p-4"
              >
                <div className="text-xs font-semibold text-slate-500">
                  Cluster {cluster.cluster_id}
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  {cluster.root_cause_summary}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Keywords: {cluster.top_keywords.join(", ")}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Departments: {cluster.affected_departments.join(", ") || "—"}
                </p>
              </div>
            ))}
            {!loading && clusters.length === 0 && (
              <p className="text-sm text-slate-500">No clusters yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
