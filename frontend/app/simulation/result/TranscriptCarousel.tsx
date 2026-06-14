"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppIcon from "@/app/components/AppIcon";
import { askAICoach, type CoachResult } from "@/app/actions";

function HighlightedTranscript({ text }: { text: string }) {
  const fillerWords = [
    "umm", "uhh", "um", "uh", "eee", "kayak", "gitu", 
    "like", "basically", "literally", "actually", "you know"
  ];
  
  const regex = new RegExp(`\\b(${fillerWords.join('|')})\\b`, 'gi');
  const parts = text.split(regex);
  const fillerWordsLower = fillerWords.map(w => w.toLowerCase());

  return (
    <>
      {parts.map((part, i) => {
        if (fillerWordsLower.includes(part.toLowerCase())) {
          return (
            <span key={i} className="inline-block px-1.5 mx-[2px] rounded-md bg-rose-100 text-rose-700 font-semibold text-[13px] relative -top-px shadow-sm">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ─── Local UI Components ───────────────────────────────────────────────

function RewriteSuggestion({ original, improved, reasoning, lang }: { original: string; improved: string; reasoning: string; lang?: string }) {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[20px] border border-indigo-100 bg-indigo-50/50 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex size-6 items-center justify-center rounded-full bg-indigo-600 text-white">
          <AppIcon name="ai" className="size-3.5" />
        </div>
        <h4 className="text-[13px] font-bold uppercase tracking-wider text-indigo-900">{lang === "id" ? "Saran Frasa Lebih Baik" : "Better Phrasing"}</h4>
      </div>
      
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
          <span className="text-[10px] font-bold uppercase text-rose-500 tracking-wider mb-2 block">{lang === "id" ? "Anda bilang" : "You said"}</span>
          <p className="text-[14px] text-rose-900 font-light leading-relaxed strike line-through opacity-70">
            {original || (lang === "id" ? "(AI tidak dapat mengekstrak teks asli)" : "(AI could not extract the original text)")}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-emerald-200/50 to-transparent blur-2xl rounded-full" />
          <span className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider mb-2 block">{lang === "id" ? "Disarankan" : "Suggested"}</span>
          <p className="text-[14px] text-emerald-950 font-medium leading-relaxed relative z-10">
            {improved}
          </p>
        </div>
      </div>
      <p className="text-[13px] text-indigo-700 leading-relaxed italic mt-2">
        <span className="font-semibold not-italic">{lang === "id" ? "Mengapa ini lebih baik:" : "Why this works:"}</span> {reasoning}
      </p>
    </div>
  );
}

function CoachingInsights({ strengths, weaknesses, tips, lang }: { strengths: string[], weaknesses: string[], tips: string[], lang?: string }) {
  return (
    <div className="mt-4 flex flex-col gap-4 rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-3">
        <div className="flex size-6 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </div>
        <h4 className="text-[13px] font-bold uppercase tracking-wider text-slate-900">{lang === "id" ? "Pesan Pelatih" : "Coach's Takeaway"}</h4>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h5 className="text-[12px] font-bold uppercase text-emerald-600 tracking-wider mb-3">{lang === "id" ? "Kekuatan" : "Strengths"}</h5>
          <ul className="flex flex-col gap-2">
            {strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-[14px] text-slate-600 font-light">
                <span className="text-emerald-500 mt-0.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h5 className="text-[12px] font-bold uppercase text-rose-500 tracking-wider mb-3">{lang === "id" ? "Area Peningkatan" : "Areas to Improve"}</h5>
          <ul className="flex flex-col gap-2">
            {weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-[14px] text-slate-600 font-light">
                <span className="text-rose-400 mt-0.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {tips.length > 0 && (
        <div className="mt-2 rounded-xl bg-slate-50 p-4 border border-slate-100">
          <h5 className="text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-2">{lang === "id" ? "Tips Pro" : "Pro Tip"}</h5>
          <p className="text-[13px] text-slate-700 leading-relaxed font-light">{tips[0]}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export function TranscriptCarousel({
  questions,
  transcripts,
  context,
  cachedCoachData,
  onCoachComplete,
  lang,
}: {
  questions: string[];
  transcripts: string[];
  context: {
    finalScore: number;
    contentScore: number;
    deliveryScore: number;
    nonVerbalScore: number;
  };
  cachedCoachData?: Record<number, CoachResult>;
  onCoachComplete?: (index: number, result: CoachResult) => void;
  lang?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  
  // Initialize state with cached data if available
  const [coachDataMap, setCoachDataMap] = useState<Record<number, CoachResult>>(
    cachedCoachData || {}
  );
  const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<number, string>>({});

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setDirection(1);
      setCurrentIndex(c => c + 1);
    }
  };
  
  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(c => c - 1);
    }
  };

  const handleAskCoach = async () => {
    // If we already have the data locally or cached, do nothing
    if (coachDataMap[currentIndex]) return;

    setLoadingMap(prev => ({ ...prev, [currentIndex]: true }));
    setErrorMap(prev => ({ ...prev, [currentIndex]: "" }));
    try {
      const activeLang = lang || (typeof window !== "undefined" ? localStorage.getItem("lumenLanguage") || "en" : "en");
      const response = await askAICoach(questions[currentIndex], transcripts[currentIndex], context, activeLang);
      setCoachDataMap(prev => ({ ...prev, [currentIndex]: response }));
      if (onCoachComplete) {
        onCoachComplete(currentIndex, response);
      }
    } catch (err: unknown) {
      console.error(err);
      setErrorMap(prev => ({ ...prev, [currentIndex]: "Failed to load AI Coach response. Please ensure your API key is correct." }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [currentIndex]: false }));
    }
  };

  const currentCoachData = coachDataMap[currentIndex];
  const isLoading = loadingMap[currentIndex];
  const errorMsg = errorMap[currentIndex];

  const currentQuestion = questions[currentIndex];
  const currentTranscript = transcripts[currentIndex] || (lang === "id" ? "Tidak ada jawaban jelas yang terekam untuk pertanyaan ini." : "No distinct answer recorded for this question.");

  return (
    <div className="border border-slate-200 bg-white rounded-[24px] p-6 shadow-sm relative overflow-hidden">
      
      {/* Carousel Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-[12px] font-bold text-slate-600">
            Q{currentIndex + 1}
          </span>
          <span className="text-[12px] font-bold tracking-widest text-slate-400 uppercase">
            {lang === "id" ? "dari" : "of"} {questions.length}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrev} 
            disabled={currentIndex === 0}
            className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {/* Custom chevron left */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <button 
            onClick={handleNext} 
            disabled={currentIndex === questions.length - 1}
            className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {/* Custom chevron right */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Slide Content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div 
          key={currentIndex}
          custom={direction}
          initial={{ opacity: 0, x: direction > 0 ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction > 0 ? -20 : 20 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="flex flex-col gap-6"
        >
          <h3 className="text-[18px] font-semibold text-slate-900 leading-relaxed">
            {currentQuestion}
          </h3>
          
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 relative">
            <span className="absolute top-4 left-4 text-4xl text-slate-200 font-serif leading-none select-none">&ldquo;</span>
            <p className="text-[15px] leading-[28px] text-slate-600 font-light italic relative z-10 pl-6">
              <HighlightedTranscript text={currentTranscript} />
            </p>
            
            <div className="mt-6 pt-6 border-t border-slate-200/60 pl-6 flex items-center justify-between">
              <span className="text-[12px] font-medium text-slate-400">{lang === "id" ? "Jawaban Anda" : "Your Answer"}</span>
              
              {!currentCoachData && !isLoading && (
                <button
                  onClick={handleAskCoach}
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-4 py-1.5 text-[12px] font-bold text-indigo-600 hover:bg-indigo-100 transition-colors"
                >
                  <AppIcon name="ai" className="size-3.5" />
                  {lang === "id" ? "Dapatkan Saran AI" : "Get AI Suggestion"}
                </button>
              )}
              
              {isLoading && (
                <div className="flex items-center gap-2 text-[13px] text-slate-500 font-medium">
                  <div className="size-4 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                  {lang === "id" ? "Menganalisis..." : "Analyzing..."}
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="mt-4 pl-6 text-rose-500 text-[13px] font-medium">{errorMsg}</div>
            )}
          </div>

          {/* AI Results Section */}
          {currentCoachData && (
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.2,
                    delayChildren: 0.1
                  }
                }
              }}
              className="flex flex-col gap-2 mt-2"
            >
              <motion.div variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
              }}>
                <RewriteSuggestion 
                  original={currentCoachData.rewrite.originalTextExcerpt} 
                  improved={currentCoachData.rewrite.improvedAnswer} 
                  reasoning={currentCoachData.rewrite.reasoning} 
                  lang={lang}
                />
              </motion.div>
              <motion.div variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
              }}>
                <CoachingInsights 
                  strengths={currentCoachData.coaching.strengths} 
                  weaknesses={currentCoachData.coaching.weaknesses} 
                  tips={currentCoachData.coaching.tips} 
                  lang={lang}
                />
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

    </div>
  );
}
