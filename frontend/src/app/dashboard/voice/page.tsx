"use client";

import { useState } from "react";

type VoiceResponse = {
  original_text: string;
  translated_text: string;
  category: string;
  urgency_score: number;
};

export default function VoiceIngestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VoiceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("audio_file", file);
      const res = await fetch("http://localhost:8000/api/voice-ingest", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Failed to process audio");
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="float-in">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-700">
            CivicLens AI
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Voice Ingest
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Upload a complaint recording to transcribe, translate, and classify.
          </p>
        </header>

        <section className="mt-8 rounded-3xl glass p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!file || loading}
              className="w-fit rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "Processing…" : "Upload & Analyze"}
            </button>
          </form>

          {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

          {result && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/60 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Original Text
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {result.original_text || "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Translated Text
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {result.translated_text || "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Category
                </p>
                <p className="mt-2 text-sm text-slate-700">{result.category}</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Urgency Score
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {result.urgency_score}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
