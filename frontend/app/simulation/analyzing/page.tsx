"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

import {
  analyzeRecording,
  getQuestionTopic,
  loadAnswerBlob,
  loadSessionAnswers,
  loadSimulationConfig,
  saveAnalysisResult,
  saveSessionToHistory,
  saveSimulationConfig,
  type AnalyzeResponse,
  type SessionAnswer,
} from "@/app/lib/analysis";

// ─── Types ──────────────────────────────────────────────────────────────────

type StepState = "pending" | "active" | "done" | "error";

type Step = { id: number; label: string; tech: string };

const BASE_STEPS: Step[] = [
  { id: 1, label: "Audio Transcription",       tech: "Groq Whisper STT" },
  { id: 2, label: "Speech Pattern Analysis",   tech: "Wav2Vec2 · Silero VAD" },
  { id: 3, label: "Facial Expression",         tech: "YOLOv8 · Face Detector" },
  { id: 4, label: "Semantic Content Scoring",  tech: "IndoBERT · S-BERT" },
  { id: 5, label: "Generating Feedback",       tech: "Weighted Fusion" },
];

function stepState(id: number, active: number, done: boolean): StepState {
  if (done || id < active) return "done";
  if (id === active) return "active";
  return "pending";
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect width="14" height="14" rx="3" fill="#22C55E" />
      <polyline points="3,7 6,10 11,4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect width="14" height="14" rx="3" fill="#EF4444" />
      <line x1="4" y1="4" x2="10" y2="10" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="10" y1="4" x2="4" y2="10" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ─── Merge helper ────────────────────────────────────────────────────────────
// Average numeric scores across all per-question results into one composite.
function mergeResults(results: AnalyzeResponse[]): AnalyzeResponse {
  if (results.length === 0) throw new Error("No results to merge.");
  if (results.length === 1) return results[0];

  const avg = (key: keyof AnalyzeResponse) =>
    Math.round(
      results.reduce((s, r) => s + (r[key] as number), 0) / results.length,
    );

  const base = results[results.length - 1]; // keep last for metadata
  return {
    ...base,
    final_score:     avg("final_score"),
    content_score:   avg("content_score"),
    delivery_score:  avg("delivery_score"),
    non_verbal_score: avg("non_verbal_score"),
    // Merge transcriptions
    transcription: results.map((r, i) => `Q${i + 1}: ${r.transcription}`).join("\n\n"),
    // Merge feedback (concatenate per-question)
    feedback: {
      content:    results.map((r, i) => `[Q${i + 1}] ${r.feedback.content}`).join("  "),
      delivery:   results.map((r, i) => `[Q${i + 1}] ${r.feedback.delivery}`).join("  "),
      non_verbal: results.map((r, i) => `[Q${i + 1}] ${r.feedback.non_verbal}`).join("  "),
    },
    // Average delivery metrics
    delivery_metrics: {
      ...base.delivery_metrics,
      wpm: Math.round(results.reduce((s, r) => s + r.delivery_metrics.wpm, 0) / results.length),
      filler_rate: parseFloat(
        (results.reduce((s, r) => s + r.delivery_metrics.filler_rate, 0) / results.length).toFixed(1),
      ),
      duration_sec: results.reduce((s, r) => s + r.delivery_metrics.duration_sec, 0),
    },
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AnalyzingPage() {
  const router = useRouter();
  const startedRef = useRef(false);

  const [answers, setAnswers]         = useState<SessionAnswer[]>([]);
  const [currentAnswerIdx, setIdx]    = useState(0);  // which answer we're processing
  const [activeStep, setActiveStep]   = useState(1);
  const [phaseLabel, setPhaseLabel]   = useState("");
  const [finished, setFinished]       = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [progress, setProgress]       = useState(0); // 0-100 overall

  async function runAnalysis() {
    const sessionAnswers = loadSessionAnswers();

    // Fallback: if no per-question answers, the legacy single-recording path
    if (sessionAnswers.length === 0) {
      // Try legacy path
      const { loadRecordingFromSession } = await import("@/app/lib/analysis");
      const recording = await loadRecordingFromSession();
      if (!recording) {
        setError("No recording found. Please record your interview again.");
        return;
      }
      
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const sessionId = new Date().toISOString().replace(/[:.]/g, "-");
      const videoPaths: string[] = [];
      
      const analyzePromise = analyzeOne(
        recording.blob,
        {
          questionIndex: 1,
          questionText: recording.meta?.questionText ?? "",
          idbKey: "lumenRecording",
          mimeType: recording.meta?.mimeType ?? "video/webm",
          durationSec: recording.meta?.durationSec ?? 0,
          recordedAt: recording.meta?.recordedAt ?? new Date().toISOString(),
        },
        videoPaths
      );
      
      if (user) {
        const filePath = `${user.id}/${sessionId}_Q1.webm`;
        const uploadPromise = supabase.storage
          .from("interview_videos")
          .upload(filePath, recording.blob, { upsert: true })
          .then(({ error }) => {
            if (!error) videoPaths.push(filePath);
          });
        await Promise.all([analyzePromise, uploadPromise]);
      } else {
        await analyzePromise;
      }
      return;
    }

    setAnswers(sessionAnswers);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const sessionId = new Date().toISOString().replace(/[:.]/g, "-");
    const videoPaths: string[] = [];

    const results: AnalyzeResponse[] = [];
    const total = sessionAnswers.length;

    for (let i = 0; i < total; i++) {
      const answer = sessionAnswers[i];
      setIdx(i);
      setPhaseLabel(`Analyzing Q${answer.questionIndex} of ${total}`);

      const blob = await loadAnswerBlob(answer.idbKey);
      if (!blob) {
        setError(`Could not load recording for Q${answer.questionIndex}. Please try again.`);
        return;
      }

      const stepTimer = startStepTimer();
      try {
        const config = loadSimulationConfig();
        const qText = answer.questionText.trim() || config.questions[answer.questionIndex - 1] || "";

        const analyzePromise = analyzeRecording(blob, {
          questionTopic: getQuestionTopic(),
          questionText: qText,
          mimeType: answer.mimeType,
        });

        let uploadPromise = Promise.resolve();
        if (user) {
          const filePath = `${user.id}/${sessionId}_Q${answer.questionIndex}.webm`;
          uploadPromise = supabase.storage
            .from("interview_videos")
            .upload(filePath, blob, { upsert: true })
            .then(({ error }) => {
              if (!error) videoPaths.push(filePath);
            });
        }

        const [result] = await Promise.all([analyzePromise, uploadPromise]);
        
        results.push(result);
        setProgress(Math.round(((i + 1) / total) * 100));
      } catch (err) {
        clearInterval(stepTimer);
        setError(
          err instanceof Error
            ? err.message
            : `Analysis failed for Q${answer.questionIndex}.`,
        );
        return;
      }
      clearInterval(stepTimer);
      setActiveStep(BASE_STEPS.length);
    }

    // Merge and save
    const merged = mergeResults(results);
    saveSessionToHistory(merged, getQuestionTopic(), videoPaths);

    // Update config with the actual questions asked so result page and history are correct
    const config = loadSimulationConfig();
    config.questions = sessionAnswers.map(a => a.questionText);
    saveSimulationConfig(config);

    saveAnalysisResult(merged);
    setFinished(true);
    setProgress(100);
    setTimeout(() => router.push("/simulation/result"), 800);
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runAnalysis();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Animates step progress while one answer is being analyzed */
  function startStepTimer(): ReturnType<typeof setInterval> {
    setActiveStep(1);
    let step = 1;
    return setInterval(() => {
      step = Math.min(step + 1, BASE_STEPS.length);
      setActiveStep(step);
    }, 3200);
  }

  // Legacy helper (single recording fallback)
  async function analyzeOne(
    blob: Blob,
    answer: SessionAnswer,
    videoUrls: string[] = []
  ) {
    const stepTimer = startStepTimer();
    try {
      const config = loadSimulationConfig();
      const qText = answer.questionText.trim() || config.questions[0] || "";
      const result = await analyzeRecording(blob, {
        questionTopic: getQuestionTopic(),
        questionText: qText,
        mimeType: answer.mimeType,
      });
      saveAnalysisResult(result);
      saveSessionToHistory(result, getQuestionTopic(), videoUrls);
      clearInterval(stepTimer);
      setActiveStep(BASE_STEPS.length);
      setFinished(true);
      setProgress(100);
      setTimeout(() => router.push("/simulation/result"), 800);
    } catch (err) {
      clearInterval(stepTimer);
      setError(
        err instanceof Error
          ? err.message
          : "Analysis failed. Check that the backend is running.",
      );
    }
  }

  const totalAnswers = answers.length || 1;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex min-h-full flex-col bg-[#0F172A] px-8 py-12 sm:px-14 sm:py-16"
      style={{ fontFamily: "'Space Grotesk', 'DM Sans', system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-px w-8 bg-[#22C55E]/60" />
        <span className="text-[10px] font-semibold uppercase tracking-[2.5px] text-white/30">
          {error ? "Analysis error" : finished ? "Complete" : phaseLabel || "Analyzing your interview"}
        </span>
      </div>

      <h1 className="mt-6 text-[48px] font-black uppercase leading-[1.05] tracking-[-2px] text-white sm:text-[56px]">
        Reading
        <br />
        <span className="text-[#22C55E]">between</span>
        <br />
        the lines.
      </h1>

      <p className="mt-5 max-w-[520px] text-[13px] leading-relaxed text-white/40">
        {error
          ? "Analysis could not complete. See the message below and try again."
          : `Running transcription, delivery metrics, and content scoring across ${totalAnswers} answer${totalAnswers > 1 ? "s" : ""}. This may take a few minutes on first run.`}
      </p>

      {/* ── Overall progress bar (multi-question) ── */}
      {!error && totalAnswers > 1 && (
        <div className="mt-6 max-w-[540px]">
          <div className="flex justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-white/30">
              Overall progress
            </span>
            <span className="text-[10px] font-mono text-white/30">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#22C55E] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Question tabs */}
          <div className="mt-3 flex gap-2 flex-wrap">
            {answers.map((a, i) => (
              <span
                key={a.questionIndex}
                className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  i < currentAnswerIdx
                    ? "bg-[#22C55E]/20 text-[#22C55E]"
                    : i === currentAnswerIdx
                    ? "bg-white/10 text-white ring-1 ring-white/20"
                    : "bg-white/5 text-white/20"
                }`}
              >
                Q{a.questionIndex}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {error ? (
        <div className="mt-8 max-w-[540px] rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 p-5">
          <p className="text-[12px] font-medium uppercase tracking-[1px] text-[#EF4444]">{error}</p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/simulation/recording"
              className="rounded-lg bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#0F172A] hover:bg-white/90 transition-colors"
            >
              Record again
            </Link>
            <Link
              href="/simulation/setup"
              className="rounded-lg border border-white/20 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white/60 hover:bg-white/5 transition-colors"
            >
              Back to setup
            </Link>
          </div>
        </div>
      ) : (
        /* ── Steps list ── */
        <div className="mt-8 w-full max-w-[540px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#1E293B]">
          {BASE_STEPS.map((step) => {
            const state = stepState(step.id, activeStep, finished);
            return (
              <div
                key={step.id}
                className={`flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5 last:border-b-0 transition-colors duration-300 ${
                  state === "active" ? "bg-white/[0.05]" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-5 shrink-0 items-center justify-center">
                    {state === "done" ? (
                      <CheckIcon />
                    ) : state === "error" ? (
                      <ErrorIcon />
                    ) : (
                      <span
                        className={`flex size-5 items-center justify-center rounded border text-[10px] font-bold ${
                          state === "active"
                            ? "border-[#22C55E]/50 text-[#22C55E]"
                            : "border-white/15 text-white/25"
                        }`}
                      >
                        {step.id}
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[12px] font-semibold uppercase tracking-[0.8px] transition-colors ${
                      state === "active"
                        ? "text-white"
                        : state === "done"
                        ? "text-white/60"
                        : "text-white/20"
                    }`}
                  >
                    {step.label}
                  </span>

                  {state === "active" && (
                    <span className="ml-1 size-3 animate-spin rounded-full border-2 border-[#22C55E]/20 border-t-[#22C55E]" />
                  )}
                </div>

                <span
                  className={`text-[11px] tracking-[0.3px] transition-colors ${
                    state === "active"
                      ? "text-white/40"
                      : state === "done"
                      ? "text-white/20"
                      : "text-white/10"
                  }`}
                >
                  {step.tech}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;700&display=swap');
      `}</style>
    </div>
  );
}
