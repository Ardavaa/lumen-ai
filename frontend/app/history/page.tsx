"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, useEffect } from "react";

import AppIcon from "@/app/components/AppIcon";
import {
  formatDuration,
  selectSession,
  STORAGE_KEYS,
  fetchUserHistoryFromDB,
  deleteSessionHistoryFromDB,
  type SessionRecord,
} from "@/app/lib/analysis";
import { Sidebar } from "@/app/components/Sidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

function sessionTrend(
  sessions: SessionRecord[],
  index: number,
): "up" | "down" | "same" {
  if (index >= sessions.length - 1) return "same";
  const current = sessions[index].result.final_score;
  const older = sessions[index + 1].result.final_score;
  if (current > older) return "up";
  if (current < older) return "down";
  return "same";
}

function subscribeToStorage(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getHistorySnapshot(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEYS.history) ?? "";
}

function parseHistorySnapshot(snapshot: string): SessionRecord[] {
  if (!snapshot) return [];
  try {
    return JSON.parse(snapshot) as SessionRecord[];
  } catch {
    return [];
  }
}

function getLanguageSnapshot(): string {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(STORAGE_KEYS.language) ?? "en";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TrendBadge({ trend }: { trend: "up" | "down" | "same" }) {
  if (trend === "up")   return <span className="flex items-center justify-center size-6 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100/50"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg></span>;
  if (trend === "down") return <span className="flex items-center justify-center size-6 rounded-full bg-rose-50 text-rose-600 border border-rose-100/50"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>;
  return <span className="flex items-center justify-center size-6 rounded-full bg-slate-50 text-slate-400 border border-slate-100"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg></span>;
}

function ScoreBar({ score }: { score: number }) {
  const colorClass = score >= 80 ? "bg-emerald-500" : score >= 70 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="relative h-1.5 w-[60px] bg-slate-100 rounded-full overflow-hidden">
      <div className={`absolute inset-y-0 left-0 rounded-full ${colorClass}`} style={{ width: `${score}%` }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [search, setSearch] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const languageStr = useSyncExternalStore(subscribeToStorage, getLanguageSnapshot, () => "en");
  const language = (languageStr === "id" ? "id" : "en") as "en" | "id";

  const setLanguage = (lang: "en" | "id") => {
    localStorage.setItem(STORAGE_KEYS.language, lang);
    window.dispatchEvent(new Event("storage"));
  };

  async function handleDelete(record: SessionRecord) {
    if (!confirm(language === "id" ? "Yakin ingin menghapus sesi ini? Tindakan ini tidak dapat dibatalkan." : "Are you sure you want to delete this session? This cannot be undone.")) return;
    setIsDeleting(record.id);
    const success = await deleteSessionHistoryFromDB(record);
    if (!success) {
      alert(language === "id" ? "Gagal menghapus sesi." : "Failed to delete session.");
    }
    setIsDeleting(null);
  }

  useEffect(() => {
    fetchUserHistoryFromDB().catch(console.error);
  }, []);

  const historySnapshot = useSyncExternalStore(
    subscribeToStorage,
    getHistorySnapshot,
    () => "",
  );
  const sessions = useMemo(
    () => parseHistorySnapshot(historySnapshot),
    [historySnapshot],
  );

  const visible = useMemo(() => {
    return sessions.filter((s) =>
      s.questionTopic.toLowerCase().includes(search.toLowerCase()) || (s.categoryLabel && s.categoryLabel.toLowerCase().includes(search.toLowerCase()))
    );
  }, [sessions, search]);

  const summary = useMemo(() => {
    if (sessions.length === 0) {
      return { avgScore: "0", best: "0", total: "0", avgDuration: "0:00" };
    }
    const scores = sessions.map((s) => s.result.final_score);
    const durations = sessions.map((s) => s.result.delivery_metrics.duration_sec);
    const avgSec = durations.reduce((a, b) => a + b, 0) / durations.length;
    return {
      avgScore: String(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)),
      best: String(Math.max(...scores)),
      total: String(sessions.length),
      avgDuration: formatDuration(avgSec),
    };
  }, [sessions]);

  const isId = language === "id";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      {/* ── Main ── */}
      <main className="flex-1 p-6 sm:p-10 overflow-y-auto custom-scrollbar">
        {/* Header with Language Toggle */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {isId ? "Riwayat Sesi" : "Session History"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {sessions.length} {isId ? "sesi" : `session${sessions.length !== 1 ? 's' : ''}`} &middot; {isId ? "Diurutkan berdasarkan tanggal" : "Sorted by date"}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center bg-white border border-slate-200 rounded-full p-1 shadow-sm">
              <button 
                onClick={() => setLanguage("en")} 
                className={`px-4 py-1.5 text-[13px] font-semibold rounded-full transition-all ${language === 'en' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                English
              </button>
              <button 
                onClick={() => setLanguage("id")} 
                className={`px-4 py-1.5 text-[13px] font-semibold rounded-full transition-all ${language === 'id' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Indonesia
              </button>
            </div>
            <Link
              href="/simulation/setup"
              className="relative text-sm font-medium rounded-full h-12 p-1 ps-6 pe-14 group transition-all duration-500 hover:ps-12 hover:pe-8 w-fit overflow-hidden cursor-pointer bg-[#0A0D14] text-white hover:bg-white hover:text-[#0A0D14] border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)] inline-flex items-center justify-center"
            >
              <span className="relative z-10 block transition-all duration-500 ease-out group-hover:translate-x-3">
                {isId ? "Simulasi Baru" : "New Simulation"}
              </span>
              <div className="absolute right-1 w-10 h-10 bg-white text-[#0A0D14] rounded-full flex items-center justify-center transition-all duration-500 group-hover:right-[calc(100%-44px)] group-hover:rotate-45 group-hover:bg-[#0A0D14] group-hover:text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#0A0D14] group-hover:text-white">
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
              </div>
            </Link>
          </div>
        </div>

        {/* ── METRICS GRID (SaaS Card Design) ── */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[
            { label: isId ? "Rata-rata Skor" : "Avg Score", value: summary.avgScore, icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /> },
            { label: isId ? "Sesi Terbaik" : "Best Session", value: summary.best, icon: <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /> },
            { label: isId ? "Total Sesi" : "Total Sessions", value: summary.total, icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></> },
            { label: isId ? "Rata-rata Durasi" : "Avg Duration", value: summary.avgDuration, icon: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></> },
          ].map((stat) => (
            <div key={stat.label} className="group relative flex items-center overflow-hidden rounded-[20px] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {stat.icon}
                </svg>
              </div>
              <div className="ml-4 flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{stat.label}</span>
                <span className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">{stat.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Controls ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full max-w-sm">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder={isId ? "Cari riwayat sesi..." : "Search sessions..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-[13px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
            />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
            {visible.length} {isId ? "hasil" : `result${visible.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* ── History List (Soft Card Container) ── */}
        <div className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          {/* List Header */}
          <div className="hidden lg:grid grid-cols-[1.5fr_140px_100px_120px_120px_60px_80px] items-center gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-3.5">
            {[
              isId ? "Topik Sesi" : "Session Topic",
              isId ? "Kategori" : "Category",
              isId ? "Kata Pengisi" : "Fillers",
              isId ? "Tanggal" : "Date",
              isId ? "Skor Akhir" : "Final Score",
              isId ? "Tren" : "Trend",
              isId ? "Aksi" : "Actions"
            ].map((h, idx) => (
              <span key={idx} className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</span>
            ))}
          </div>

          {/* List Body */}
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-slate-50 mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-900">{isId ? "Riwayat Kosong" : "No Sessions Found"}</p>
              <p className="mt-1 text-sm text-slate-500 max-w-xs">{isId ? "Anda belum melakukan simulasi yang cocok dengan pencarian ini." : "You haven't completed any simulations matching this search."}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visible.map((s, i) => {
                const score = s.result.final_score;
                const scoreColor = score >= 80 ? "text-emerald-600" : score >= 70 ? "text-amber-600" : "text-rose-600";
                const name = s.questionTopic;
                const duration = formatDuration(s.result.delivery_metrics.duration_sec);
                const idx = sessions.findIndex((x) => x.id === s.id);
                const trend = sessionTrend(sessions, idx);

                return (
                  <div
                    key={s.id}
                    className={`grid grid-cols-1 lg:grid-cols-[1.5fr_140px_100px_120px_120px_60px_80px] items-center gap-4 px-6 py-5 transition-colors hover:bg-slate-50/80 ${
                      isDeleting === s.id ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    {/* Session Name & Meta */}
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="truncate text-[14px] font-semibold text-slate-900" title={name}>
                        {name}
                      </span>
                      <span className="text-[12px] text-slate-500">
                        {duration} &middot; {s.result.delivery_metrics.wpm} WPM
                      </span>
                    </div>

                    {/* Category */}
                    <div>
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 border border-indigo-100/50">
                        {s.categoryLabel ?? "SIMULATION"}
                      </span>
                    </div>

                    {/* Fillers */}
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-slate-700">
                        {s.result.delivery_metrics.filler_count}
                      </span>
                    </div>

                    {/* Date */}
                    <div>
                      <span className="text-[13px] font-medium text-slate-500">{s.date}</span>
                    </div>

                    {/* Score */}
                    <div className="flex flex-col gap-1.5">
                      <span className={`text-[16px] font-bold tracking-tight ${scoreColor}`}>
                        {score}<span className="text-[11px] text-slate-400 font-semibold ml-0.5">/100</span>
                      </span>
                      <ScoreBar score={score} />
                    </div>

                    {/* Trend */}
                    <div className="hidden lg:flex items-center">
                      <TrendBadge trend={trend} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 justify-end lg:justify-start mt-4 lg:mt-0">
                      <Link
                        href={`/report-cards?session=${encodeURIComponent(s.id)}`}
                        onClick={() => selectSession(s)}
                        className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                        title={isId ? "Lihat rapor" : "View report"}
                      >
                        <AppIcon name="arrow-right" className="size-4" />
                      </Link>

                      <button
                        onClick={() => handleDelete(s)}
                        disabled={isDeleting === s.id}
                        className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        title={isId ? "Hapus sesi" : "Delete session"}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18"></path>
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
