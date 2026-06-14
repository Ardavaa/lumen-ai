"use client";

import { useEffect, useState, useRef } from "react";
import AppIcon from "@/app/components/AppIcon";

export function OverallAIInsight({
  scores,
  feedback,
  cachedInsight,
  onComplete,
  lang,
}: {
  scores: { final: number; content: number; delivery: number; nonVerbal: number };
  feedback: Record<string, unknown>;
  cachedInsight?: string;
  onComplete?: (insight: string) => void;
  lang?: string;
}) {
  const [displayedText, setDisplayedText] = useState(cachedInsight || "");
  const rawTextRef = useRef("");
  const [isLoading, setIsLoading] = useState(!cachedInsight);
  const [isTyping, setIsTyping] = useState(false);
  const hasStartedRef = useRef(false);
  const streamDoneRef = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    if (cachedInsight) {
      return;
    }


    async function fetchStream() {
      try {
        const prompt = `Overall Score: ${scores.final}/100\nContent: ${scores.content}/100\nDelivery: ${scores.delivery}/100\nNon-verbal: ${scores.nonVerbal}/100\n\nOriginal Feedback Data:\n${JSON.stringify(feedback)}\n\nWrite a 3-sentence overall summary with **highlights**. ${lang === "id" ? "The summary MUST be in Indonesian (Bahasa Indonesia)." : "The summary MUST be in English."}`;
        const response = await fetch("/api/score-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });

        if (!response.body) {
          setError("No response body");
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        setIsLoading(false);
        setIsTyping(true);

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            streamDoneRef.current = true;
            if (onComplete) onComplete(rawTextRef.current);
            break;
          }
          const chunk = decoder.decode(value, { stream: true });
          rawTextRef.current += chunk;
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      }
    }

    fetchStream();
  }, [scores, feedback, cachedInsight, onComplete]);

  // Smooth typewriter effect
  useEffect(() => {
    if (!isTyping) return;

    const interval = setInterval(() => {
      setDisplayedText((prev) => {
        const raw = rawTextRef.current;
        if (prev.length < raw.length) {
          // If we're lagging behind the network chunks a lot, type faster
          const diff = raw.length - prev.length;
          const charsToAdd = diff > 20 ? 3 : diff > 10 ? 2 : 1;
          return raw.substring(0, prev.length + charsToAdd);
        } else if (streamDoneRef.current) {
          clearInterval(interval);
          setIsTyping(false);
          return prev;
        }
        return prev; // Wait for more chunks
      });
    }, 15); // Adjust for smooth typing speed

    return () => clearInterval(interval);
  }, [isTyping]);

  const parseRichText = (text: string) => {
    const parts = text.split("**");
    return parts.map((part, i) => {
      // Odd indices are inside the bold tags
      if (i % 2 === 1) {
        if (!part) return null; // prevent empty styled blocks
        return (
          <span key={i} className="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/50 shadow-sm mx-0.5 inline-block transition-all duration-200">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="mt-8 border border-indigo-100 bg-white rounded-[20px] p-6 shadow-sm relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-100/40 to-transparent blur-2xl rounded-full" />
      <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3 relative z-10">
        <AppIcon name="ai" className="size-5 text-indigo-600" />
        <h3 className="text-[14px] font-bold uppercase tracking-widest text-slate-900">
          {lang === "id" ? "Evaluasi Keseluruhan AI" : "AI Overall Evaluation"}
        </h3>
      </div>

      <div className="min-h-[60px] relative z-10">
        {error && (
          <div className="text-[13px] text-rose-500 font-medium">{lang === "id" ? "Gagal memuat evaluasi AI:" : "Failed to load AI evaluation:"} {error}</div>
        )}

        {isLoading && !error ? (
          <div className="flex flex-col gap-3 w-full animate-pulse mt-2">
            <div className="h-3 bg-slate-100 rounded-full w-full"></div>
            <div className="h-3 bg-slate-100 rounded-full w-5/6"></div>
            <div className="h-3 bg-slate-100 rounded-full w-4/6"></div>
          </div>
        ) : (
          <p className="text-[14px] leading-[28px] text-slate-600 font-light whitespace-pre-wrap transition-opacity duration-300">
            {parseRichText(displayedText || (isTyping ? "" : (lang === "id" ? "Menunggu evaluasi..." : "Waiting for evaluation...")))}
            {isTyping && <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-400 animate-pulse align-middle" />}
          </p>
        )}
      </div>
    </div>
  );
}
