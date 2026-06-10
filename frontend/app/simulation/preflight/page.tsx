"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getApiBaseUrl } from "@/app/lib/analysis";

// ─── Types ──────────────────────────────────────────────────────────────────

type ModelStatus = "idle" | "checking" | "ok" | "error";

interface ModelEntry {
  key: string;
  label: string;
  description: string;
  status: ModelStatus;
  elapsedMs: number | null;
  message: string;
}

// ─── Model manifest ─────────────────────────────────────────────────────────

const INITIAL_MODELS: ModelEntry[] = [
  {
    key: "groq",
    label: "Groq Whisper STT",
    description: "Groq API · transcribes your answer",
    status: "idle",
    elapsedMs: null,
    message: "",
  },
  {
    key: "wav2vec2",
    label: "Wav2Vec2 SER",
    description: "Voice emotion · detects tone & stress",
    status: "idle",
    elapsedMs: null,
    message: "",
  },
  {
    key: "sbert",
    label: "S-BERT Content",
    description: "Semantic scoring · rates answer quality",
    status: "idle",
    elapsedMs: null,
    message: "",
  },
  {
    key: "yolo",
    label: "YOLOv8 Facial",
    description: "Facial emotion · reads expressions in real-time",
    status: "idle",
    elapsedMs: null,
    message: "",
  },
  {
    key: "mediapipe",
    label: "Face Detector",
    description: "Face detection · locates face for bounding box",
    status: "idle",
    elapsedMs: null,
    message: "",
  },
];

// ─── Icons ──────────────────────────────────────────────────────────────────

function IconCheck() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <path
        d="M3 8.5l3.5 3.5 6.5-7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="size-4 animate-spin"
      aria-hidden
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeDasharray="28"
        strokeDashoffset="10"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M8 2a6 6 0 0 1 6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconIdle() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
    </svg>
  );
}

// ─── Row component ───────────────────────────────────────────────────────────

function ModelRow({ entry, index }: { entry: ModelEntry; index: number }) {
  const statusColor: Record<ModelStatus, string> = {
    idle: "text-white/20",
    checking: "text-[#3a8377]",
    ok: "text-[#3a8377]",
    error: "text-[#c75240]",
  };

  const rowBg: Record<ModelStatus, string> = {
    idle: "border-white/5 bg-white/[0.02]",
    checking: "border-[#3a8377]/30 bg-[#3a8377]/5",
    ok: "border-[#3a8377]/20 bg-[#3a8377]/5",
    error: "border-[#c75240]/30 bg-[#c75240]/5",
  };

  const statusLabel: Record<ModelStatus, string> = {
    idle: "waiting",
    checking: "loading…",
    ok: entry.elapsedMs !== null ? `ready · ${(entry.elapsedMs / 1000).toFixed(1)}s` : "ready",
    error: "failed",
  };

  return (
    <div
      className={`flex items-center gap-4 rounded-xl border px-4 py-3.5 transition-all duration-300 ${rowBg[entry.status]}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Index */}
      <span className="w-5 shrink-0 text-center font-mono text-[11px] text-white/20">
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* Status icon */}
      <span className={`shrink-0 ${statusColor[entry.status]}`}>
        {entry.status === "idle" && <IconIdle />}
        {entry.status === "checking" && <IconSpinner />}
        {entry.status === "ok" && <IconCheck />}
        {entry.status === "error" && <IconX />}
      </span>

      {/* Label + description */}
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="text-[13px] font-semibold uppercase tracking-[0.8px] text-[#faf7f2]">
          {entry.label}
        </span>
        <span className="truncate text-[11px] tracking-[0.3px] text-white/40">
          {entry.message || entry.description}
        </span>
      </div>

      {/* Status badge */}
      <span
        className={`shrink-0 text-[10px] font-medium uppercase tracking-[1px] ${statusColor[entry.status]}`}
      >
        {statusLabel[entry.status]}
      </span>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PreflightPage() {
  const router = useRouter();
  const [models, setModels] = useState<ModelEntry[]>(INITIAL_MODELS);
  const [done, setDone] = useState(false);
  const [hasError, setHasError] = useState(false);
  const startedRef = useRef(false);
  const [runCount, setRunCount] = useState(0);

  const completed = models.filter((m) => m.status === "ok" || m.status === "error").length;
  const total = models.length;
  const progress = Math.round((completed / total) * 100);

  function setModelStatus(
    key: string,
    patch: Partial<Omit<ModelEntry, "key" | "label" | "description">>,
  ) {
    setModels((prev) =>
      prev.map((m) => (m.key === key ? { ...m, ...patch } : m)),
    );
  }

  function handleRetry() {
    startedRef.current = false;
    setModels(INITIAL_MODELS);
    setDone(false);
    setHasError(false);
    setRunCount((c) => c + 1);
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function runChecks() {
      let anyError = false;

      for (const model of INITIAL_MODELS) {
        setModelStatus(model.key, { status: "checking" });

        // Small stagger so the UI feels alive
        await new Promise((r) => setTimeout(r, 150));

        try {
          const res = await fetch(
            `${getApiBaseUrl()}/api/preflight/${model.key}`,
            { signal: AbortSignal.timeout(600_000) },
          );

          if (!res.ok) {
            const text = await res.text().catch(() => `HTTP ${res.status}`);
            setModelStatus(model.key, {
              status: "error",
              message: text.slice(0, 80),
            });
            anyError = true;
          } else {
            const data = await res.json();
            if (data.status === "ok") {
              setModelStatus(model.key, {
                status: "ok",
                elapsedMs: data.elapsed_ms ?? null,
              });
            } else {
              setModelStatus(model.key, {
                status: "error",
                message: (data.message ?? "unknown error").slice(0, 80),
              });
              anyError = true;
            }
          }
        } catch (err) {
          // TypeError ("Failed to fetch") means the backend process is not
          // running or is unreachable — give the user an actionable message.
          let msg: string;
          if (err instanceof TypeError) {
            msg = "Backend offline – start the server and retry";
          } else if (err instanceof DOMException && err.name === "TimeoutError") {
            msg = "Request timed out – model may still be loading";
          } else {
            msg = err instanceof Error ? err.message : "network error";
          }
          setModelStatus(model.key, { status: "error", message: msg.slice(0, 100) });
          anyError = true;
        }
      }

      setHasError(anyError);
      setDone(true);
    }

    runChecks();
  }, [runCount]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f1117] px-4 py-12">
      <div className="w-full max-w-[520px]">

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[2px] text-[#3a8377]">
              [ System Check ]
            </span>
          </div>
          <h1 className="text-[22px] font-bold uppercase tracking-[-0.5px] text-[#faf7f2]">
            Loading AI models
          </h1>
          <p className="mt-1.5 text-[12px] leading-relaxed tracking-[0.3px] text-white/40">
            All models must be ready before the session starts. On first run
            the server downloads model weights (~500 MB) — this can take a few
            minutes. Subsequent starts load instantly from local cache.
          </p>
        </div>

        {/* ── Checklist ── */}
        <div className="flex flex-col gap-2">
          {models.map((m, i) => (
            <ModelRow key={m.key} entry={m} index={i} />
          ))}
        </div>

        {/* ── Progress bar ── */}
        <div className="mt-6">
          <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[1px] text-white/30">
            <span>Progress</span>
            <span>{completed} / {total}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#3a8377] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-[11px] uppercase tracking-[1.2px] text-white/30 hover:text-white/60"
          >
            ← Back
          </button>

          <div className="flex items-center gap-3">
            {done && hasError && (
              <>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="border border-[#3a8377]/50 px-5 py-3 text-[11px] uppercase tracking-[1.2px] text-[#3a8377] hover:border-[#3a8377] hover:bg-[#3a8377]/10 transition-colors"
                >
                  ↺ Retry
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/simulation/recording")}
                  className="border border-white/20 px-5 py-3 text-[11px] uppercase tracking-[1.2px] text-white/50 hover:border-white/40 hover:text-white/70"
                >
                  Skip & continue anyway
                </button>
              </>
            )}

            <button
              type="button"
              disabled={!done || hasError}
              onClick={() => router.push("/simulation/recording")}
              className="flex items-center gap-2 border border-[#3a8377] bg-[#3a8377] px-6 py-3 text-[12px] font-semibold uppercase tracking-[1.3px] text-[#faf7f2] transition-colors hover:bg-[#2f6e65] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/20"
            >
              {!done ? (
                <>
                  <IconSpinner />
                  Checking…
                </>
              ) : hasError ? (
                "Models not ready"
              ) : (
                <>
                  <IconCheck />
                  Enter session
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Footer note ── */}
        {done && !hasError && (
          <p className="mt-4 text-center text-[10px] uppercase tracking-[1px] text-[#3a8377]">
            [ All {total} models loaded — session ready ]
          </p>
        )}
        {done && hasError && (
          <p className="mt-4 text-center text-[10px] uppercase tracking-[1px] text-[#c75240]">
            [ Some models failed — analysis accuracy may be reduced ]
          </p>
        )}
      </div>
    </div>
  );
}
