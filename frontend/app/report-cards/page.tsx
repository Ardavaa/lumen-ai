"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, useEffect } from "react";

import { createClient } from "@/utils/supabase/client";
import {
  type AnalyzeResponse,
  emotionBorderColor,
  formatDuration,
  loadAnalysisResult,
  loadSelectedSession,
  STORAGE_KEYS,
  fetchUserHistoryFromDB,
  type SessionRecord,
} from "@/app/lib/analysis";
import { Sidebar } from "@/app/components/Sidebar";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "Overview" | "Delivery" | "Non-Verbal" | "Transcript";

type Metric = {
  label: string;
  value: string;
  color: string;
  pct: number;
};

type Feedback = {
  type: "warn" | "good";
  title: string;
  detail: string;
};

const EMOTION_BAR_COLORS: Record<string, string> = {
  neutral: "#10b981", // emerald-500
  happy: "#10b981",
  surprise: "#f59e0b", // amber-500
  sad: "#ef4444", // red-500
  angry: "#ef4444",
  fear: "#ef4444",
  disgust: "#ef4444",
};

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconWarn() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmotionDistributionChart({ latest }: { latest: AnalyzeResponse }) {
  const vm = latest.video_emotion_metrics;
  const entries = Object.entries(vm.emotion_distribution).sort((a, b) => b[1] - a[1]);

  if (vm.frames_analyzed === 0) {
    return (
      <div className="mt-6 rounded-2xl bg-white border border-slate-100 p-6 shadow-sm">
        <span className="text-sm font-medium text-slate-500">
          Facial Emotion Distribution
        </span>
        <p className="mt-2 text-sm text-red-500">
          No face detected in video — ensure your face is visible and well-lit.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl bg-white border border-slate-100 p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">
          Facial Emotion Distribution
        </span>
        <span className="text-xs font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
          {vm.frames_analyzed} frames · Dominant: <span className="capitalize">{vm.dominant_emotion}</span>
        </span>
      </div>
      <div className="flex h-32 items-end gap-3">
        {entries.map(([label, pct]) => (
          <div key={label} className="flex flex-1 flex-col items-center gap-2 group">
            <div
              className="w-full min-w-[12px] rounded-t-md transition-all duration-300 group-hover:opacity-80"
              style={{
                height: `${Math.max(5, pct * 100)}%`,
                backgroundColor: EMOTION_BAR_COLORS[label] ?? "#f59e0b",
              }}
            />
            <span className="text-xs font-medium text-slate-500 capitalize">
              {label.slice(0, 4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }}
      />
    </div>
  );
}

function FillerHighlight({ text, fillers }: { text: string; fillers: string[] }) {
  if (!fillers || fillers.length === 0) return <span>{text}</span>;
  
  const unique = [...new Set(fillers)].sort((a, b) => b.length - a.length);
  const parts: { chunk: string; highlight: boolean }[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let earliestIdx = -1;
    let earliestFiller = "";
    const lower = remaining.toLowerCase();

    for (const f of unique) {
      const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      const match = re.exec(lower);
      if (match && (earliestIdx === -1 || match.index < earliestIdx)) {
        earliestIdx = match.index;
        earliestFiller = remaining.slice(match.index, match.index + match[0].length);
      }
    }

    if (earliestIdx === -1) {
      parts.push({ chunk: remaining, highlight: false });
      break;
    }
    if (earliestIdx > 0) {
      parts.push({ chunk: remaining.slice(0, earliestIdx), highlight: false });
    }
    parts.push({ chunk: earliestFiller, highlight: true });
    remaining = remaining.slice(earliestIdx + earliestFiller.length);
  }

  return (
    <>
      {parts.map((p, i) =>
        p.highlight ? (
          <mark key={i} className="rounded-md bg-red-100 px-1 py-0.5 text-red-800 font-medium not-italic">
            {p.chunk}
          </mark>
        ) : (
          <span key={i}>{p.chunk}</span>
        ),
      )}
    </>
  );
}

function buildMetricsFromResult(result: AnalyzeResponse): Metric[] {
  const dm = result.delivery_metrics;
  const em = result.emotion_metrics;
  const vm = result.video_emotion_metrics;

  const wpmPct = Math.max(0, 100 - (Math.abs(dm.wpm - 140) / 60) * 100);

  return [
    {
      label: "Speaking Rate",
      value: `${dm.wpm} WPM`,
      pct: wpmPct,
      color: dm.wpm >= 120 && dm.wpm <= 160 ? "#10b981" : "#f59e0b",
    },
    {
      label: "Filler Words",
      value: `${dm.filler_count} (${dm.filler_rate}%)`,
      pct: Math.max(0, 100 - dm.filler_rate * 12),
      color: dm.filler_rate <= 4 ? "#10b981" : "#f59e0b",
    },
    {
      label: "Average Pause",
      value: `${dm.avg_pause_sec}s`,
      pct: dm.avg_pause_sec >= 0.25 && dm.avg_pause_sec <= 1.2 ? 100 : 60,
      color: "#10b981",
    },
    {
      label: "Longest Silence",
      value: `${dm.longest_silence_sec}s`,
      pct: dm.longest_silence_sec <= 2 ? 100 : 50,
      color: dm.longest_silence_sec <= 2 ? "#10b981" : "#f59e0b",
    },
    {
      label: "Voice Emotion",
      value: em.chunks_analyzed > 0 ? em.dominant_emotion : "N/A",
      pct: em.emotion_score,
      color: em.emotion_score >= 70 ? "#10b981" : "#f59e0b",
    },
    {
      label: "Facial Emotion",
      value:
        vm.frames_analyzed > 0
          ? `${vm.dominant_emotion} (${vm.non_verbal_score}/100)`
          : "No face detected",
      pct: vm.non_verbal_score,
      color: vm.frames_analyzed > 0 && vm.non_verbal_score >= 70 ? "#10b981" : "#f59e0b",
    },
  ];
}

function buildFeedbackFromResult(result: AnalyzeResponse): Feedback[] {
  return [
    { type: "warn", title: "Content Analysis", detail: result.feedback.content },
    { type: "warn", title: "Delivery & Fluency", detail: result.feedback.delivery },
    {
      type: result.non_verbal_score >= 75 ? "good" : "warn",
      title: "Non-verbal Cues",
      detail: result.feedback.non_verbal,
    },
  ];
}

function EmptyAnalysisPrompt() {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm border border-slate-100 text-slate-400">
        <IconSparkles />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900">No analysis available</h3>
        <p className="mt-1 text-sm text-slate-500">Run a simulation to see your detailed AI report card.</p>
      </div>
      <Link
        href="/simulation/setup"
        className="mt-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 hover:scale-[1.02]"
      >
        Start New Simulation
      </Link>
    </div>
  );
}

function OverviewTab({ latest }: { latest: AnalyzeResponse | null }) {
  if (!latest) return <EmptyAnalysisPrompt />;

  const metrics = buildMetricsFromResult(latest);
  const feedback = buildFeedbackFromResult(latest);

  return (
    <div className="mt-8 flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Top AI Score Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 text-white shadow-xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-slate-300 mb-2">
              <IconSparkles />
              <span className="text-sm font-medium">Lumen AI Analysis</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Your Final Score</h2>
            <p className="mt-2 max-w-xl text-slate-400">
              Based on a comprehensive evaluation of your content, vocal delivery, and non-verbal communication.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-white/10 p-5 rounded-2xl backdrop-blur-md border border-white/10">
            <div className="text-6xl font-black tracking-tighter text-white">
              {latest.final_score}
            </div>
            <div className="text-sm font-medium text-slate-300">
              Out of <br/> 100
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        {/* ── Left: Delivery metrics + chart ── */}
        <div className="flex flex-col gap-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
            <h3 className="mb-6 text-lg font-semibold tracking-tight text-slate-900">
              Performance Metrics
            </h3>

            <div className="grid gap-6 sm:grid-cols-2">
              {metrics.map((m) => (
                <div key={m.label} className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 border border-slate-100/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">{m.label}</span>
                    <span className="text-sm font-bold" style={{ color: m.color }}>
                      {m.value}
                    </span>
                  </div>
                  <MetricBar pct={m.pct} color={m.color} />
                </div>
              ))}
            </div>
          </div>

          <EmotionDistributionChart latest={latest} />
        </div>

        {/* ── Right: Actionable feedback ── */}
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm h-fit">
          <div className="mb-6 flex items-center gap-2 text-indigo-600">
            <IconSparkles />
            <span className="text-sm font-semibold tracking-wide uppercase">Actionable Feedback</span>
          </div>

          <div className="flex flex-col gap-6">
            {feedback.map((fb) => (
              <div key={fb.title} className="flex gap-4 items-start">
                <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${fb.type === 'good' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {fb.type === 'good' ? <IconCheck /> : <IconWarn />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 mb-1">
                    {fb.title}
                  </p>
                  <p className="text-sm leading-relaxed text-slate-600">{fb.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function wpmScorePct(wpm: number): number {
  const delta = Math.abs(wpm - 140);
  return Math.max(0, 100 - (delta / 60) * 100);
}

function DeliveryTab({ latest }: { latest: AnalyzeResponse | null }) {
  if (!latest) return <EmptyAnalysisPrompt />;

  const dm = latest.delivery_metrics;
  const em = latest.emotion_metrics;
  const wpmPct = wpmScorePct(dm.wpm);
  const wpmColor = dm.wpm >= 120 && dm.wpm <= 160 ? "#10b981" : "#f59e0b";

  const rows = [
    {
      label: "Speaking Rate",
      value: `${dm.wpm} WPM`,
      desc: "Ideal range: 130–150 WPM",
      pct: wpmPct,
      color: wpmColor,
    },
    {
      label: "Filler Words",
      value: `${dm.filler_count} detected`,
      desc: `${dm.filler_rate}% of total words`,
      pct: Math.max(0, 100 - dm.filler_rate * 12),
      color: dm.filler_rate <= 4 ? "#10b981" : "#f59e0b",
    },
    {
      label: "Average Pause",
      value: `${dm.avg_pause_sec}s`,
      desc: "Natural cadence",
      pct: dm.avg_pause_sec >= 0.25 && dm.avg_pause_sec <= 1.2 ? 100 : 60,
      color: "#10b981",
    },
    {
      label: "Longest Silence",
      value: `${dm.longest_silence_sec}s`,
      desc: "Maximum gap between words",
      pct: dm.longest_silence_sec <= 2 ? 100 : 50,
      color: dm.longest_silence_sec <= 2 ? "#10b981" : "#f59e0b",
    },
    {
      label: "Voice Emotion Score",
      value: em.chunks_analyzed > 0 ? `${em.emotion_score}/100` : "N/A",
      desc: em.chunks_analyzed > 0 ? `Dominant: ${em.dominant_emotion}` : "No speech analyzed",
      pct: em.emotion_score,
      color: em.emotion_score >= 70 ? "#10b981" : "#f59e0b",
    },
    {
      label: "Voice Stability",
      value: em.chunks_analyzed > 0 ? `${Math.round(em.stability_score * 100)}%` : "N/A",
      desc: em.chunks_analyzed > 0 ? `Nervous markers: ${Math.round(em.nervous_rate * 100)}%` : "N/A",
      pct: em.stability_score * 100,
      color: em.stability_score >= 0.7 ? "#10b981" : "#f59e0b",
    },
  ];

  return (
    <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">Delivery & Fluency</h3>
            <p className="mt-1 text-slate-500">How you sounded during the interview.</p>
          </div>
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-100">
            <span className="text-xl font-bold text-indigo-600">{latest.delivery_score}</span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-sm font-semibold text-slate-900">{row.label}</span>
                  <p className="text-xs text-slate-500 mt-0.5">{row.desc}</p>
                </div>
                <span className="text-sm font-bold" style={{ color: row.color }}>
                  {row.value}
                </span>
              </div>
              <MetricBar pct={row.pct} color={row.color} />
            </div>
          ))}
        </div>

        {dm.filler_words_found.length > 0 && (
          <div className="mt-8 rounded-2xl bg-amber-50 p-6 border border-amber-100">
            <p className="mb-3 text-sm font-semibold text-amber-900">
              Detected Filler Words
            </p>
            <div className="flex flex-wrap gap-2">
              {[...new Set(dm.filler_words_found)].map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-800 shadow-sm"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 rounded-2xl bg-slate-50 p-6 border border-slate-100">
          <div className="flex items-center gap-2 mb-2 text-indigo-600">
            <IconSparkles />
            <span className="text-sm font-semibold">AI Coaching</span>
          </div>
          <p className="text-sm leading-relaxed text-slate-700">{latest.feedback.delivery}</p>
        </div>
      </div>
    </div>
  );
}

function NonVerbalTab({ latest, selectedSession }: { latest: AnalyzeResponse | null, selectedSession: SessionRecord | null }) {
  const [signedUrls, setSignedUrls] = useState<string[]>([]);
  
  useEffect(() => {
    if (!selectedSession?.videoUrls?.length) {
      setTimeout(() => setSignedUrls([]), 0);
      return;
    }
    
    async function fetchUrls() {
      const supabase = createClient();
      const urls: string[] = [];
      for (const path of selectedSession!.videoUrls!) {
        const { data } = await supabase.storage.from("interview_videos").createSignedUrl(path, 60 * 60);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      setSignedUrls(urls);
    }
    fetchUrls().catch(console.error);
  }, [selectedSession]);

  if (!latest) return <EmptyAnalysisPrompt />;

  const vm = latest.video_emotion_metrics;

  if (vm.frames_analyzed === 0) {
    return (
      <div className="mt-8 max-w-3xl rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
        <h3 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
          Non-verbal Analysis
        </h3>
        <p className="text-slate-500 mb-6">Visual cues and body language.</p>
        <div className="rounded-2xl bg-red-50 p-6 border border-red-100">
          <p className="text-sm font-medium text-red-800">{latest.feedback.non_verbal}</p>
          <p className="mt-2 text-xs text-red-600/80">
            Sampled {vm.frames_sampled} frames — no face detected for YOLOv8 classification.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl">
      
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
        <div className="flex flex-col gap-8">
          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold tracking-tight text-slate-900">Non-Verbal Cues</h3>
                <p className="mt-1 text-slate-500">Visual signals and facial expressions.</p>
              </div>
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-100">
                <span className="text-xl font-bold text-indigo-600">{vm.non_verbal_score}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100 text-center">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Dominant</span>
                <p className="mt-2 text-lg font-bold capitalize" style={{ color: emotionBorderColor(vm.dominant_emotion) }}>
                  {vm.dominant_emotion}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100 text-center">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Stability</span>
                <p className="mt-2 text-lg font-bold text-slate-900">{Math.round(vm.stability_score * 100)}%</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100 text-center">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Nervous</span>
                <p className="mt-2 text-lg font-bold text-slate-900">{Math.round(vm.nervous_rate * 100)}%</p>
              </div>
            </div>
            
            <MetricBar
              pct={vm.non_verbal_score}
              color={vm.non_verbal_score >= 70 ? "#10b981" : "#f59e0b"}
            />
            
            <div className="mt-8 rounded-2xl bg-slate-50 p-6 border border-slate-100">
              <div className="flex items-center gap-2 mb-2 text-indigo-600">
                <IconSparkles />
                <span className="text-sm font-semibold">AI Coaching</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-700">{latest.feedback.non_verbal}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          {signedUrls.length > 0 && (
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Recording Playback</h3>
              <div className="flex flex-col gap-4">
                {signedUrls.map((url, i) => (
                  <div key={i} className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden shadow-inner">
                    <video src={url} controls className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
          <EmotionDistributionChart latest={latest} />
        </div>
      </div>
    </div>
  );
}

function TranscriptTab({ latest }: { latest: AnalyzeResponse | null }) {
  if (!latest) return <EmptyAnalysisPrompt />;
  
  if (!latest.transcription) {
    return (
      <div className="mt-8 flex h-48 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/50">
        <span className="text-sm font-medium text-slate-500">No transcript available for this session.</span>
      </div>
    );
  }

  return (
    <div className="mt-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-6">
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">Interview Transcript</h3>
            <p className="mt-1 text-sm text-slate-500">Full speech-to-text with filler word highlights.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-emerald-700 border border-emerald-100">
            <IconCheck />
            <span className="text-sm font-bold">Content Score: {latest.final_score}</span>
          </div>
        </div>
        
        <div className="prose prose-slate max-w-none">
          <p className="text-base leading-loose text-slate-700">
            <FillerHighlight
              text={latest.transcription}
              fillers={latest.delivery_metrics.filler_words_found ?? []}
            />
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: Tab[] = ["Overview", "Delivery", "Non-Verbal", "Transcript"];

type ReportSnapshot = {
  latest: AnalyzeResponse | null;
  selectedSession: SessionRecord | null;
};

function subscribeToStorage(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getReportSnapshotKey(): string {
  return [
    window.location.search,
    localStorage.getItem(STORAGE_KEYS.history) ?? "",
    localStorage.getItem(STORAGE_KEYS.selectedSessionId) ?? "",
    sessionStorage.getItem(STORAGE_KEYS.analysisResult) ?? "",
  ].join("\n");
}

function readReportSnapshot(): ReportSnapshot {
  const sessionId = new URLSearchParams(window.location.search).get("session");
  const selectedSession = loadSelectedSession(sessionId);
  return {
    selectedSession,
    latest: selectedSession?.result ?? loadAnalysisResult(),
  };
}

export default function ReportCardsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchUserHistoryFromDB().catch(console.error);
  }, []);

  const reportSnapshotKey = useSyncExternalStore(
    subscribeToStorage,
    getReportSnapshotKey,
    () => "",
  );
  const { latest, selectedSession } = useMemo(
    () =>
      reportSnapshotKey
        ? readReportSnapshot()
        : { latest: null, selectedSession: null },
    [reportSnapshotKey],
  );

  const today =
    selectedSession?.date ?? new Date().toISOString().slice(0, 10).replace(/-/g, ".");

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const htmlToImage = await import("html-to-image");
      const { jsPDF } = await import("jspdf");

      const element = document.getElementById("report-content");
      if (!element) return;

      const imgData = await htmlToImage.toPng(element, { pixelRatio: 2, backgroundColor: "#FAFAFA" });

      const width = element.offsetWidth;
      const height = element.offsetHeight;

      const pdf = new jsPDF({
        orientation: height > width ? "portrait" : "landscape",
        unit: "px",
        format: [width, height],
      });

      pdf.addImage(imgData, "PNG", 0, 0, width, height);
      pdf.save(`Lumen_Report_${today}.pdf`);
    } catch (err) {
      console.error("Failed to export PDF", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAFA]">
      <Sidebar />

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto px-6 py-8 md:px-12 md:py-10">
        
        {/* Header section */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
              <span>Report</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>{today}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="text-slate-900">{selectedSession?.categoryLabel ?? "Latest Simulation"}</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">
              Detailed Analysis
            </h1>
          </div>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExporting}
            className={`flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50 ${
              isExporting ? "opacity-50 cursor-wait" : ""
            }`}
          >
            {isExporting ? (
              <svg className="animate-spin h-4 w-4 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
            {isExporting ? "Exporting..." : "Export PDF"}
          </button>
        </div>

        <div id="report-content" className="bg-[#FAFAFA] -mx-6 px-6 md:-mx-12 md:px-12 pb-10">
          {/* ── Apple-style Segmented Control Tabs ── */}
          <div className="flex p-1 space-x-1 bg-slate-200/50 rounded-xl w-fit" data-html2canvas-ignore>
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  activeTab === tab
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div className="pb-10">
          {activeTab === "Overview"   && <OverviewTab latest={latest ?? null} />}
          {activeTab === "Delivery"   && <DeliveryTab latest={latest ?? null} />}
          {activeTab === "Non-Verbal" && <NonVerbalTab latest={latest ?? null} selectedSession={selectedSession ?? null} />}
          {activeTab === "Transcript" && <TranscriptTab latest={latest ?? null} />}
          </div>
        </div>
      </main>
    </div>
  );
}
