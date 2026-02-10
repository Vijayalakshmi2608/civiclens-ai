import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CivicLens AI",
  description: "AI-powered civic complaint analytics dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen ambient-bg">
          <nav className="sticky top-0 z-20 border-b border-white/40 bg-white/70 backdrop-blur-xl">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-sm">
                  CivicLens
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  AI Operations
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                <a
                  href="/dashboard"
                  className="rounded-full px-4 py-1.5 transition hover:bg-white/80 hover:text-slate-900"
                >
                  Dashboard
                </a>
                <a
                  href="/dashboard/compare"
                  className="rounded-full px-4 py-1.5 transition hover:bg-white/80 hover:text-slate-900"
                >
                  Compare
                </a>
                <a
                  href="/dashboard/voice"
                  className="rounded-full px-4 py-1.5 transition hover:bg-white/80 hover:text-slate-900"
                >
                  Voice
                </a>
                <a
                  href="/dashboard/root-cause"
                  className="rounded-full px-4 py-1.5 transition hover:bg-white/80 hover:text-slate-900"
                >
                  Root Cause
                </a>
                <a
                  href="/dashboard/risk"
                  className="rounded-full px-4 py-1.5 transition hover:bg-white/80 hover:text-slate-900"
                >
                  Risk Zones
                </a>
                <a
                  href="/dashboard/map"
                  className="rounded-full px-4 py-1.5 transition hover:bg-white/80 hover:text-slate-900"
                >
                  City Map
                </a>
                <a
                  href="/dashboard/admin"
                  className="rounded-full px-4 py-1.5 transition hover:bg-white/80 hover:text-slate-900"
                >
                  Admin
                </a>
              </div>
            </div>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
