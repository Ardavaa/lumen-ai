"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useSyncExternalStore, useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import AppIcon, { type IconName } from "@/app/components/AppIcon";
import { Sidebar } from "@/app/components/Sidebar";
import ButtonWithIcon from "@/components/ui/button-witn-icon";
import Aurora from "@/components/ui/Aurora";
import BorderGlow from "@/components/ui/BorderGlow";
import {
  formatDuration,
  selectSession,
  STORAGE_KEYS,
  fetchUserHistoryFromDB,
  type SessionRecord,
  type CategoryId,
  SIMULATION_CATEGORIES,
  saveSimulationConfig,
  type SimulationConfig,
  getApiBaseUrl,
} from "@/app/lib/analysis";
import { useRouter } from "next/navigation";

// ─── UTILS & STORAGE ────────────────────────────────────────────────────────


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

// ─── UI COMPONENTS ──────────────────────────────────────────────────────────


import { LineChart, Line, ResponsiveContainer } from "recharts";

function Sparkline({ data, color, className = "" }: { data: number[], color: string, className?: string, isNegative?: boolean }) {
  if (!data || data.length === 0) return <div className={`h-12 opacity-10 bg-slate-200 rounded-md w-full ${className}`} />;

  let displayData = data.map((val, index) => ({
    index,
    value: val,
  }));

  if (displayData.length === 1) {
    displayData = [
      { index: 0, value: displayData[0].value },
      { index: 1, value: displayData[0].value },
    ];
  }

  return (
    <div className={`relative w-full h-12 overflow-hidden pointer-events-none ${className}`}>
      {/* Subtle baseline reference indicator */}
      <div className="absolute inset-x-0 bottom-[4px] border-b border-slate-100 pointer-events-none" />
      
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={displayData}
          margin={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Line
            dataKey="value"
            type="monotone"
            stroke={color}
            strokeWidth={1.8}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── SETUP MODAL COMPONENTS ──────────────────────────────────────────────────

type Category = {
  id: CategoryId;
  icon: IconName;
  name: string;
  meta: string;
};

const CATEGORIES: Category[] = [
  { id: "sw-engineer", icon: "code", name: "SW Engineer", meta: "Technical · 3 Q" },
  { id: "data-analyst", icon: "chart", name: "Data Analyst", meta: "Case · 3 Q" },
  { id: "product-mgr", icon: "briefcase", name: "Product Mgr", meta: "Behavioral · 3 Q" },
  { id: "marketing", icon: "megaphone", name: "Marketing", meta: "Case · 3 Q" },
  { id: "ui-ux", icon: "palette", name: "UI / UX", meta: "Portfolio · 3 Q" },
  { id: "general", icon: "message", name: "General", meta: "Intro · 3 Q" },
];

type CategoryCardProps = {
  category: Category;
  selected: boolean;
  onClick: () => void;
};

function CategoryCard({ category, selected, onClick }: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col gap-3 rounded-[16px] p-4 text-left transition-all duration-200 border ${
        selected
          ? "border-indigo-500 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500/20"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className={`flex size-10 items-center justify-center rounded-[12px] transition-colors duration-200 ${selected ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700"}`}>
        <AppIcon name={category.icon} className="size-5" />
      </div>
      <div>
        <p className={`text-[15px] font-semibold tracking-tight ${selected ? "text-indigo-900" : "text-slate-900"}`}>
          {category.name}
        </p>
        <p className={`text-[12px] mt-0.5 ${selected ? "text-indigo-600/80" : "text-slate-500"}`}>{category.meta}</p>
      </div>
    </button>
  );
}

// ─── DASHBOARD PAGE ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [setupPhase, setSetupPhase] = useState<"options" | "preflight">("options");
  const [loadingModelIndex, setLoadingModelIndex] = useState(0);
  const [preflightError, setPreflightError] = useState("");

  const languageStr = useSyncExternalStore(subscribeToStorage, getLanguageSnapshot, () => "en");
  const language = (languageStr === "id" ? "id" : "en") as "en" | "id";

  const setLanguage = (lang: "en" | "id") => {
    localStorage.setItem(STORAGE_KEYS.language, lang);
    window.dispatchEvent(new Event("storage"));
  };

  const [selectedId, setSelectedId] = useState<CategoryId | null>("sw-engineer");
  const [customTopic, setCustomTopic] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<"friendly" | "strict" | "stress">("friendly");

  useEffect(() => {
    if (!isSetupOpen) {
      setSetupPhase("options");
      setLoadingModelIndex(0);
      setPreflightError("");
    }
  }, [isSetupOpen]);

  useEffect(() => {
    if (setupPhase !== "preflight") return;

    let isCancelled = false;

    async function runChecks() {
      const models = [
        { key: "groq", label: "Speech to Text Model" },
        { key: "wav2vec2", label: "Voice Emotion Model" },
        { key: "sbert", label: "Semantic Scoring Model" },
        { key: "yolo", label: "Facial Expression Model" },
        { key: "mediapipe", label: "Face Detector Model" },
      ];

      for (let i = 0; i < models.length; i++) {
        if (isCancelled) return;
        setLoadingModelIndex(i);
        
        const model = models[i];
        try {
          const res = await fetch(`${getApiBaseUrl()}/api/preflight/${model.key}`, { 
            signal: AbortSignal.timeout(600_000) 
          });
          
          if (!res.ok) {
            if (isCancelled) return;
            setPreflightError(`Failed to load ${model.label}`);
            return;
          }
          const data = await res.json();
          if (data.status !== "ok") {
            if (isCancelled) return;
            setPreflightError(`Error in ${model.label}: ${data.message || 'unknown'}`);
            return;
          }
        } catch (err) {
          if (isCancelled) return;
          setPreflightError(`Network error while loading ${model.label}`);
          return;
        }

        await new Promise(r => setTimeout(r, 400));
      }

      if (isCancelled) return;
      router.push("/simulation/recording");
    }

    runChecks();

    return () => {
      isCancelled = true;
    };
  }, [setupPhase, router]);

  const canContinue = selectedId !== null || customTopic.trim().length > 0;

  function buildSimulationConfig(): SimulationConfig {
    const custom = customTopic.trim();
    if (custom) {
      return {
        categoryId: "custom",
        categoryLabel: language === "id" ? "Topik Kustom" : "Custom Topic",
        questionTopic: custom,
        persona: selectedPersona,
        language,
        questions: language === "id" 
          ? [
              `Perkenalkan latar belakang Anda untuk topik ini: ${custom}.`,
              "Gambarkan tantangan relevan yang pernah Anda tangani dan langkah yang Anda ambil.",
              "Apa yang akan Anda prioritaskan di 30 hari pertama untuk peran atau konteks ini?",
            ]
          : [
              `Introduce your background for this topic: ${custom}.`,
              "Describe a relevant challenge you have handled and the steps you took.",
              "What would you prioritize in your first 30 days for this role or context?",
            ],
      };
    }

    const category = CATEGORIES.find((c) => c.id === selectedId);
    if (!category) {
      return {
        categoryId: "sw-engineer",
        persona: selectedPersona,
        language,
        ...SIMULATION_CATEGORIES[language]["sw-engineer"],
      };
    }

    return {
      categoryId: category.id,
      persona: selectedPersona,
      language,
      ...SIMULATION_CATEGORIES[language][category.id],
    };
  }

  function handleContinue() {
    if (!canContinue) return;
    saveSimulationConfig(buildSimulationConfig());
    setSetupPhase("preflight");
    setLoadingModelIndex(0);
    setPreflightError("");
  }

  const historySnapshot = useSyncExternalStore(subscribeToStorage, getHistorySnapshot, () => "");
  const sessions = useMemo(() => parseHistorySnapshot(historySnapshot), [historySnapshot]);

  const [streak, setStreak] = useState(0);

  useEffect(() => {
    fetchUserHistoryFromDB().catch(console.error);
    
    async function syncStreak() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split("T")[0];
      const metadata = user.user_metadata || {};
      

      const lastLogin = metadata.last_login_date;
      let currentStreak = parseInt(metadata.login_streak || "0", 10);
      let shouldUpdate = false;

      if (!lastLogin) {
        currentStreak = 1;
        shouldUpdate = true;
      } else {
        const lastDate = new Date(lastLogin);
        const todayDate = new Date(today);
        const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          currentStreak += 1;
          shouldUpdate = true;
        } else if (diffDays > 1) {
          currentStreak = 1;
          shouldUpdate = true;
        } else {
          if (currentStreak === 0) {
            currentStreak = 1;
            shouldUpdate = true;
          }
        }
      }

      setStreak(currentStreak);

      if (shouldUpdate) {
        await supabase.auth.updateUser({
          data: {
            login_streak: currentStreak,
            last_login_date: today,
          }
        });
      }
    }

    syncStreak().catch(console.error);
  }, []);

  const { stats, insights, trends, deltas } = useMemo(() => {
    const isId = language === "id";

    if (sessions.length === 0) {
      return {
        stats: { avgScore: "0", totalSessions: "0", avgFiller: "0", avgNonVerbal: "0", readiness: 0 },
        insights: { 
          title: isId ? "Mulai Penilaian Anda" : "Setup Your Baseline",
          message: isId ? "Mulai simulasi pertama Anda untuk mendapatkan penilaian awal dan mengaktifkan pelatihan AI khusus." : "Start your first simulation to establish a performance baseline and unlock personalized AI coaching.",
          badge: isId ? "Siap Dimulai" : "Ready to Start",
          percentile: "Top 100%"
        },
        trends: { scores: [], fillers: [], nvs: [] },
        deltas: { score: 0, filler: 0, nv: 0 }
      };
    }

    const chronological = [...sessions].reverse();
    const scores = chronological.map(s => s.result.final_score);
    const fillers = chronological.map(s => s.result.delivery_metrics.filler_rate);
    const nonVerbals = chronological.map(s => s.result.video_emotion_metrics.frames_analyzed > 0 ? s.result.video_emotion_metrics.non_verbal_score : (s.result.final_score * 0.9));

    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const avgFiller = (fillers.reduce((a, b) => a + b, 0) / fillers.length).toFixed(1);
    const avgNv = Math.round(nonVerbals.reduce((a, b) => a + b, 0) / nonVerbals.length);

    // Calculate readiness metric (0-100 index based on consistency, avg score, and low fillers)
    const readiness = Math.min(100, Math.round((avgScore * 0.6) + (Math.max(0, 100 - parseFloat(avgFiller) * 5) * 0.2) + (avgNv * 0.2)));
    
    let percentile = "Top 45%";
    if (readiness >= 90) percentile = "Top 5%";
    else if (readiness >= 80) percentile = "Top 15%";
    else if (readiness >= 70) percentile = "Top 25%";

    // Deltas calculation (comparing recent half to older half)
    let scoreDelta = 0, fillerDelta = 0;
    if (sessions.length > 1) {
      const half = Math.ceil(chronological.length / 2);
      const recentScores = scores.slice(-half);
      const oldScores = scores.slice(0, half);
      
      const recentAvg = recentScores.reduce((a,b)=>a+b,0)/recentScores.length;
      const oldAvg = oldScores.reduce((a,b)=>a+b,0)/oldScores.length;
      scoreDelta = Math.round(recentAvg - oldAvg);

      const recentFillers = fillers.slice(-half);
      const oldFillers = fillers.slice(0, half);
      fillerDelta = Number(((recentFillers.reduce((a,b)=>a+b,0)/recentFillers.length) - (oldFillers.reduce((a,b)=>a+b,0)/oldFillers.length)).toFixed(1));
    }

    // Insight Logic
    let insightTitle = isId ? "Trajektori Konsisten" : "Consistent Trajectory";
    let insightMessage = isId 
      ? `Anda mempertahankan indeks kesiapan yang stabil di angka ${readiness}. Fokus pada tempo dan jeda untuk mencapai persentil berikutnya.`
      : `You're maintaining a steady readiness index of ${readiness}. Focus on pacing and pausing to push into the next percentile bracket.`;
    let insightBadge = isId ? "Sesuai Jalur" : "On Track";
    
    if (sessions.length >= 2) {
      if (scoreDelta >= 5) {
        insightTitle = isId ? "Perkembangan Pesat" : "Accelerated Growth";
        insightMessage = isId 
          ? `Momentum luar biasa! Performa Anda meningkat tajam belakangan ini, didorong oleh berkurangnya kata pengisi dan peningkatan kepercayaan diri non-verbal.`
          : `Incredible momentum! Your performance has surged recently, heavily driven by a drop in filler words and increased non-verbal confidence.`;
        insightBadge = isId ? "Tren Naik" : "Trending Up";
      } else if (parseFloat(avgFiller) < 3) {
        insightTitle = isId ? "Kejelasan Luar Biasa" : "Exceptional Clarity";
        insightMessage = isId 
          ? `Tingkat kata pengisi Anda berada di 5% teratas dari seluruh pengguna. Anda berbicara dengan tujuan yang kuat, memberikan bobot yang signifikan pada jawaban Anda.`
          : `Your filler word rate is in the top 5% of all users. You speak with high intention, giving your answers significant gravitas.`;
        insightBadge = isId ? "Tempo Elit" : "Elite Pacing";
      } else if (scoreDelta < -5) {
        insightTitle = isId ? "Perlu Penyesuaian" : "Recalibration Needed";
        insightMessage = isId 
          ? `Skor terbaru Anda sedikit menurun. Ini sering terjadi di bawah tekanan. Kunjungi kembali sesi terbaik Anda untuk menyelaraskan gaya penyampaian Anda.`
          : `Your recent scores showed a slight dip. This often happens under pressure. Revisit your best sessions to realign your delivery style.`;
        insightBadge = isId ? "Area Fokus" : "Focus Area";
      } else if (avgScore >= 85) {
        insightTitle = isId ? "Siap Wawancara" : "Interview Ready";
        insightMessage = isId 
          ? `Metrik Anda menunjukkan bahwa Anda sangat siap. Kontak mata dan penyampaian terstruktur Anda berada pada tingkat yang sangat baik.`
          : `Your metrics indicate you are highly prepared. Your eye contact and structural delivery are operating at a masterful level.`;
        insightBadge = isId ? "Sangat Menguasai" : "Masterful";
      }
    }

    return {
      stats: {
        avgScore: String(avgScore),
        totalSessions: String(sessions.length),
        avgFiller: String(avgFiller),
        avgNonVerbal: String(avgNv),
        readiness
      },
      insights: { title: insightTitle, message: insightMessage, badge: insightBadge, percentile },
      trends: {
        scores: scores.length > 1 ? scores : [scores[0] || 0, scores[0] || 0],
        fillers: fillers.length > 1 ? fillers : [fillers[0] || 0, fillers[0] || 0],
        nvs: nonVerbals.length > 1 ? nonVerbals : [nonVerbals[0] || 0, nonVerbals[0] || 0]
      },
      deltas: { score: scoreDelta, filler: fillerDelta, nv: 0 }
    };
  }, [sessions, language]);

  const recent = sessions.slice(0, 5);

  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 overflow-hidden" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* ── SIDEBAR (Floating Conferra Dark Pill Sidebar) ── */}
      <Sidebar />

      {/* ── MAIN CONTENT (Elevated Light Island) ── */}
      <main className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden bg-slate-50 isolate">
        
        {/* Layered ambient backgrounds */}
        <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-gradient-to-bl from-indigo-100/50 via-purple-50/20 to-transparent blur-3xl rounded-full -z-10 pointer-events-none" />
        <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-emerald-50/30 to-transparent blur-3xl rounded-full -z-10 pointer-events-none" />

        <div className="mx-auto w-full max-w-6xl px-8 py-10 lg:px-12 lg:py-12 flex flex-col gap-8">
          
          {/* Header & Language Switcher */}
          <div className="flex justify-end w-full">
            <div className="flex items-center bg-white border border-slate-200 rounded-full p-1 shadow-sm">
              <button 
                onClick={() => setLanguage("en")} 
                className={`px-4 py-1.5 text-[13px] font-semibold rounded-full transition-all ${language === 'en' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                English
              </button>
              <button 
                onClick={() => setLanguage("id")} 
                className={`px-4 py-1.5 text-[13px] font-semibold rounded-full transition-all ${language === 'id' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Indonesia
              </button>
            </div>
          </div>

          {/* ── HERO SECTION ── */}
          <BorderGlow
            edgeSensitivity={30}
            glowColor="240 80 80"
            backgroundColor="#0A0D14"
            borderRadius={32}
            glowRadius={40}
            glowIntensity={1.0}
            coneSpread={25}
            animated
            colors={['#c084fc', '#f472b6', '#38bdf8']}
            className="w-full"
          >
            <div className="relative overflow-hidden p-8 sm:p-10 flex flex-col xl:flex-row gap-10 items-center justify-between w-full h-full">
              {/* Animated Aurora Background */}
              <div className="absolute inset-0 opacity-40 pointer-events-none">
                <Aurora
                  colorStops={["#e1dede","#383777","#a2a4f7"]}
                  blend={0.74}
                  amplitude={1.0}
                  speed={1.6}
                />
              </div>
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-15 mix-blend-overlay pointer-events-none" />
              
              {/* Left: Hero Info */}
              <div className="relative z-10 flex-1 flex flex-col items-start w-full">
                <h2 className="text-3xl sm:text-4xl font-regular text-white tracking-tight mb-4 leading-tight">
                  {insights.title}
                </h2>
                <p className="text-slate-300 text-lg leading-relaxed max-w-2xl font-light mb-8">
                  {insights.message}
                </p>

                {/* Daily Streak Feature */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8 border-t border-white/10 pt-6 w-full max-w-xl">
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center justify-center size-14 bg-white/5 rounded-2xl border border-white/10 shrink-0">
                      <Image 
                        src="/images/flame-icon.svg" 
                        alt="Streak Flame" 
                        width={32}
                        height={32}
                        className="size-8 object-contain drop-shadow-[0_0_8px_rgba(236,111,89,0.5)] animate-pulse"
                      />
                    </div>
                    <div className="flex flex-col">
                      <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">{language === 'id' ? 'Kunjungan Beruntun' : 'Login Streak'}</div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black text-white">{streak}</span>
                        <span className="text-sm font-medium text-slate-400">{language === 'id' ? 'Hari' : (streak === 1 ? 'Day' : 'Days')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="hidden sm:block h-10 w-px bg-white/10" />
                  
                  <div className="flex flex-col gap-1.5 justify-center">
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{language === 'id' ? 'Kemajuan Mingguan' : 'Weekly Progress'}</div>
                    <div className="flex gap-2">
                      {(language === 'id' ? ['S', 'S', 'R', 'K', 'J', 'S', 'M'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']).map((day, idx) => {
                        const todayIndex = (new Date().getDay() + 6) % 7; // 0 for Monday, 6 for Sunday
                        const isActive = idx === todayIndex;
                        const isPastCompleted = idx < todayIndex && (todayIndex - idx) < streak;
                        return (
                          <div 
                            key={idx} 
                            className={`flex flex-col items-center justify-center size-8 rounded-lg text-xs font-bold transition-all duration-300 ${
                              isActive 
                                ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-[0_0_12px_rgba(245,158,11,0.4)] scale-110' 
                                : isPastCompleted
                                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                                  : 'bg-white/5 text-slate-500 border border-white/5'
                            }`}
                          >
                            {day}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right: Primary Action Center (Glassmorphism Button) */}
              <div className="relative z-10 shrink-0 flex flex-col items-center xl:items-end w-full xl:w-auto">
                <ButtonWithIcon onClick={() => setIsSetupOpen(true)} />
              </div>
            </div>
          </BorderGlow>

          {/* ── METRICS GRID (Minimal SaaS Card Design) ── */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            
            {/* Card 1: Performance Avg */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-[20px] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
              <div className="flex flex-col gap-1 mb-2">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">{language === 'id' ? 'Skor Global' : 'Global Score'}</div>
                <div className="flex items-baseline gap-1.5">
                  <div className="text-3xl font-bold tracking-tight text-slate-900">{stats.avgScore}</div>
                  <div className="text-sm font-semibold text-slate-400">/100</div>
                  {deltas.score !== 0 && (
                    <span className={`text-xs font-semibold ml-2 ${deltas.score > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {deltas.score > 0 ? '+' : ''}{deltas.score}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full h-12 mt-3">
                <Sparkline data={trends.scores} color="#383777" />
              </div>
            </div>

            {/* Card 2: Filler Reduction */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-[20px] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
              <div className="flex flex-col gap-1 mb-2">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">{language === 'id' ? 'Kata Pengisi' : 'Filler Words'}</div>
                <div className="flex items-baseline gap-1.5">
                  <div className="text-3xl font-bold tracking-tight text-slate-900">{stats.avgFiller}</div>
                  <div className="text-sm font-semibold text-slate-400">%</div>
                  {deltas.filler !== 0 && (
                    <span className={`text-xs font-semibold ml-2 ${deltas.filler < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {deltas.filler > 0 ? '+' : ''}{deltas.filler}%
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full h-12 mt-3">
                <Sparkline data={trends.fillers} color="#383777" isNegative={true} />
              </div>
            </div>

            {/* Card 3: Confidence / NV */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-[20px] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
              <div className="flex flex-col gap-1 mb-2">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">{language === 'id' ? 'Kepercayaan Diri Visual' : 'Visual Confidence'}</div>
                <div className="flex items-baseline gap-1.5">
                  <div className="text-3xl font-bold tracking-tight text-slate-900">{stats.avgNonVerbal}</div>
                  <div className="text-sm font-semibold text-slate-400">/100</div>
                </div>
              </div>
              <div className="w-full h-12 mt-3">
                <Sparkline data={trends.nvs} color="#383777" />
              </div>
            </div>

          </div>

          {/* ── PROGRESSION HISTORY (Alive Recent Sessions) ── */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between px-2">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{language === 'id' ? 'Riwayat Pelatihan' : 'Training History'}</h2>
                <p className="text-sm font-light text-slate-500 mt-1">{language === 'id' ? 'Tinjau simulasi sebelumnya untuk melihat perkembangan gaya penyampaian Anda.' : 'Review past simulations to observe your evolving delivery style.'}</p>
              </div>
              <Link
                href="/history"
                className="hidden sm:flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
              >
                <span>{language === 'id' ? 'Lihat Linimasa' : 'View Timeline'}</span>
                <AppIcon name="arrow-right" className="size-3.5" strokeWidth={3} />
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-5 rounded-[32px] bg-slate-50/50 py-20 px-6 text-center ring-1 ring-slate-200 border border-dashed border-slate-300">
                <div className="flex size-20 items-center justify-center rounded-[24px] bg-white text-slate-300 shadow-sm ring-1 ring-slate-200">
                  <AppIcon name="file" className="size-8" strokeWidth={2} />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xl font-bold text-slate-900 tracking-tight">{language === 'id' ? 'Menunggu Sesi Pertama' : 'Awaiting First Session'}</p>
                  <p className="text-base font-medium text-slate-500 max-w-md">{language === 'id' ? 'Progres kronologis Anda, lencana pelatihan, dan analisis sesi terperinci akan muncul di sini.' : 'Your chronological progress, coaching badges, and detailed session analysis will populate here.'}</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {recent.map((session) => {
                  const r = session.result;
                  const duration = formatDuration(r.delivery_metrics.duration_sec);
                  
                  const score = r.final_score;
                  let st = {
                    line: "#10b981",
                    border: "border-emerald-500",
                    textScore: "text-emerald-500",
                    textPerf: "text-emerald-500",
                    textTrend: "text-emerald-500",
                    dash: "bg-emerald-500",
                    label: "Good"
                  };
                  if (score < 50) {
                    st = { line: "#ef4444", border: "border-rose-500", textScore: "text-rose-500", textPerf: "text-rose-500", textTrend: "text-rose-500", dash: "bg-rose-500", label: "Low" };
                  } else if (score < 75) {
                    st = { line: "#f59e0b", border: "border-amber-500", textScore: "text-amber-500", textPerf: "text-amber-500", textTrend: "text-amber-500", dash: "bg-amber-500", label: "Medium" };
                  }

                  return (
                    <Link
                      key={session.id}
                      href={`/report-cards?session=${encodeURIComponent(session.id)}`}
                      onClick={() => selectSession(session)}
                      className="group flex flex-col md:flex-row items-start md:items-center justify-between rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-slate-100 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-slate-200 transition-all duration-300 gap-4 md:gap-2"
                    >
                      {/* 1. Icon & Title */}
                      <div className="flex items-start gap-4 w-full md:w-[35%] shrink-0">
                        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-400 group-hover:border-[#311f62]/30 group-hover:text-[#311f62] transition-colors">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        </div>
                        <div className="flex flex-col items-start gap-2">
                          <h4 className="text-[15px] font-medium text-slate-900 leading-snug group-hover:text-[#311f62] transition-colors">
                            {session.questionTopic.length > 50 ? `${session.questionTopic.slice(0, 50)}...` : session.questionTopic}
                          </h4>
                          <div className="rounded-full bg-slate-50 border border-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 capitalize">
                            {session.categoryLabel ?? "Simulation"}
                          </div>
                        </div>
                      </div>
                      
                      {/* 2. Date */}
                      <div className="hidden md:flex flex-col items-center justify-center w-[20%]">
                        <div className="text-[12px] font-regular text-slate-500 border-b border-dashed border-slate-300 pb-[2px]">
                          {session.date}
                        </div>
                      </div>

                      {/* 3. Clock & Duration */}
                      <div className="flex flex-col items-center w-full md:w-[15%]">
                        <div className="mb-2 text-slate-400 group-hover:text-[#311f62] transition-colors">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-regular text-slate-400">
                          Duration <span className={`flex items-center gap-0.5 ${st.textTrend}`}>{duration}</span>
                        </div>
                      </div>

                      {/* 4. Score Progress Ring */}
                      <div className="flex flex-col w-full md:w-[20%]">
                        <div className="flex items-center gap-3 mb-1.5">
                          <div className="relative size-11 shrink-0">
                            <svg className="-rotate-90 w-full h-full" viewBox="0 0 40 40">
                              <circle cx="20" cy="20" r="16" fill="none" className="stroke-slate-100" strokeWidth="3.5" />
                              <circle cx="20" cy="20" r="16" fill="none" className={st.textScore} stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" style={{ strokeDasharray: 2 * Math.PI * 16, strokeDashoffset: (2 * Math.PI * 16) - (score / 100) * (2 * Math.PI * 16) }} />
                            </svg>
                            <div className={`absolute inset-0 flex items-center justify-center text-[13px] font-black ${st.textScore}`}>
                              {score}
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-extrabold text-slate-800 leading-none mb-1.5">Score</span>
                            <span className="text-[11px] font-medium text-slate-400 leading-none">out of 100</span>
                          </div>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-400">
                          Performance <span className={st.textPerf}>{st.label}</span>
                        </div>
                      </div>

                      {/* 5. Right Arrow */}
                      <div className="hidden md:flex items-center justify-end w-[10%] shrink-0 pr-2">
                        <div className="text-slate-300 group-hover:text-[#311f62] transition-all duration-300 group-hover:translate-x-1">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* ── SETUP MODAL OVERLAY ── */}
      {isSetupOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-4 sm:p-6 backdrop-blur-md transition-all"
          onClick={() => setIsSetupOpen(false)}
        >
          <div 
            className="flex max-h-[90vh] w-full max-w-[800px] flex-col overflow-hidden bg-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.15)] rounded-[28px] ring-1 ring-slate-200/60"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top nav */}
            <nav className="flex h-16 shrink-0 items-center justify-end px-8 mt-2">
              <button
                onClick={() => setIsSetupOpen(false)}
                className="flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <AppIcon name="x" className="size-5" />
              </button>
            </nav>

            {/* Scrollable content */}
            {setupPhase === "options" ? (
              <div className="flex-1 overflow-y-auto px-8 pb-8 pt-2 sm:px-12 custom-scrollbar">
                <div className="mx-auto w-full max-w-[680px]">
                  <h2 className="text-[32px] font-semibold tracking-tight text-slate-900">
                    {language === 'id' ? 'Apa yang sedang Anda persiapkan?' : 'What are you preparing for?'}
                  </h2>
                  <p className="mt-2 text-[15px] font-light text-slate-500">
                    {language === 'id' ? 'Pilih kategori untuk menyesuaikan pertanyaan dan rubrik penilaian, atau tentukan topik Anda sendiri.' : 'Select a category to tailor the questions and scoring rubric, or define your own topic.'}
                  </p>

                  {/* Category grid */}
                  <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {CATEGORIES.map((cat) => (
                      <CategoryCard
                        key={cat.id}
                        category={{
                          ...cat,
                          name: language === 'id' ? SIMULATION_CATEGORIES[language][cat.id].categoryLabel : cat.name,
                          meta: language === 'id' ? cat.meta.replace('Q', 'P') : cat.meta
                        }}
                        selected={selectedId === cat.id}
                        onClick={() => setSelectedId(cat.id === selectedId ? null : cat.id)}
                      />
                    ))}
                  </div>

                  {/* Custom topic */}
                  <div className="mt-10 flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-slate-800">{language === 'id' ? 'Atau tentukan topik kustom' : 'Or define a custom topic'}</label>
                    <p className="text-[13px] text-slate-500 mb-1">
                      {language === 'id' ? 'Tempelkan deskripsi pekerjaan atau jelaskan perannya. Kami akan membuat pertanyaan yang relevan dengan konteks.' : 'Paste a job description or describe the role. We\'ll generate context-aware questions.'}
                    </p>
                    <div className="relative">
                      <input
                        type="text"
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        placeholder={language === 'id' ? 'misal, Senior Backend Engineer di startup fintech...' : 'e.g., Senior Backend Engineer at a fintech startup...'}
                        className="w-full rounded-[16px] border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* Persona Selection */}
                  <div className="mt-10 flex flex-col gap-3">
                    <label className="text-[14px] font-medium text-slate-800">{language === 'id' ? 'Persona Pewawancara' : 'Interviewer Persona'}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { id: "friendly", title: language === 'id' ? "HR Ramah" : "Friendly HR", desc: language === 'id' ? "Suportif & santai" : "Supportive & relaxed", emoji: "😊" },
                        { id: "strict", title: language === 'id' ? "Tech Lead Tegas" : "Strict Tech Lead", desc: language === 'id' ? "Langsung & teknis" : "Direct & technical", emoji: "👔" },
                        { id: "stress", title: language === 'id' ? "Pewawancara Menekan" : "Stress Interviewer", desc: language === 'id' ? "Menekan & skeptis" : "Pressuring & skeptical", emoji: "⚡" }
                      ].map((persona) => {
                        const isSelected = selectedPersona === persona.id;
                        return (
                          <button
                            key={persona.id}
                            type="button"
                            onClick={() => setSelectedPersona(persona.id as any)}
                            className={`flex flex-col gap-1.5 rounded-[16px] p-4 text-left transition-all border ${
                              isSelected
                                ? "border-slate-900 bg-slate-900 shadow-md shadow-slate-900/10"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <div className={`flex size-8 items-center justify-center rounded-full mb-1 ${isSelected ? "bg-white/20" : "bg-slate-100"}`}>
                              <span className="text-[16px] leading-none">{persona.emoji}</span>
                            </div>
                            <span className={`text-[14px] font-semibold tracking-tight ${isSelected ? "text-white" : "text-slate-900"}`}>{persona.title}</span>
                            <span className={`text-[12px] ${isSelected ? "text-slate-300" : "text-slate-500"}`}>{persona.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-12 flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                    <button
                      onClick={() => setIsSetupOpen(false)}
                      className="rounded-full px-5 py-2.5 text-[14px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      {language === 'id' ? 'Batal' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      disabled={!canContinue}
                      onClick={handleContinue}
                      className="flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-[14px] font-medium text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-lg hover:shadow-slate-900/20"
                    >
                      {language === 'id' ? 'Mulai Preflight' : 'Start Preflight'}
                      <AppIcon name="arrow-right" className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white/40 backdrop-blur-md min-h-[400px]">
                {preflightError ? (
                  <div className="flex flex-col items-center gap-4 text-center max-w-[320px]">
                    <div className="flex size-14 items-center justify-center rounded-full bg-red-50 text-red-500 ring-1 ring-red-500/20 shadow-sm">
                      <AppIcon name="x" className="size-6" />
                    </div>
                    <h3 className="text-[18px] font-semibold text-slate-900">{language === 'id' ? 'Kesalahan Memuat' : 'Loading Error'}</h3>
                    <p className="text-[14px] text-slate-500">{preflightError}</p>
                    <div className="mt-4 flex gap-3">
                      <button onClick={() => setSetupPhase("options")} className="rounded-full px-5 py-2.5 text-[14px] font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                        {language === 'id' ? 'Batal' : 'Cancel'}
                      </button>
                      <button 
                        onClick={() => { setPreflightError(""); setLoadingModelIndex(0); setSetupPhase("options"); setTimeout(() => setSetupPhase("preflight"), 100); }} 
                        className="rounded-full bg-slate-900 px-6 py-2.5 text-[14px] font-medium text-white hover:bg-slate-800 transition-all shadow-md"
                      >
                        {language === 'id' ? 'Coba Lagi' : 'Retry'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-8 text-center w-full max-w-[320px] transition-all">
                    {/* Rolling bar / Spinner */}
                    <div className="relative flex items-center justify-center">
                      <svg className="size-16 animate-spin text-slate-100" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
                        <path className="text-indigo-500" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-indigo-500">
                        <AppIcon name="ai" className="size-5 opacity-50" />
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 w-full">
                      <h3 className="text-[18px] font-semibold text-slate-900 tracking-tight">{language === 'id' ? 'Menyiapkan Lingkungan' : 'Preparing Environment'}</h3>
                      <p className="text-[14px] text-slate-500 animate-pulse font-medium">
                        {language === 'id' ? 'Memuat ' : 'Loading '} {
                          (language === 'id' 
                            ? ["Model Speech to Text", "Model Emosi Suara", "Model Penilaian Semantik", "Model Ekspresi Wajah", "Model Detektor Wajah"]
                            : ["Speech to Text Model", "Voice Emotion Model", "Semantic Scoring Model", "Facial Expression Model", "Face Detector Model"]
                          )[loadingModelIndex]
                        }...
                      </p>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-slate-100/80 rounded-full overflow-hidden mt-2 shadow-inner">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                        style={{ width: `${((loadingModelIndex) / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
