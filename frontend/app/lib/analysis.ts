/** Shared types and API helpers for interview analysis. */
import { createClient } from "@/utils/supabase/client";

export const STORAGE_KEYS = {
  recording: "lumenRecording",
  recordingMeta: "lumenRecordingMeta",
  questionTopic: "lumenQuestionTopic",
  simulationConfig: "lumenSimulationConfig",
  analysisResult: "lumenAnalysisResult",
  history: "lumenHistory",
  selectedSessionId: "lumenSelectedSessionId",
  // Per-question multi-answer session
  sessionAnswers: "lumenSessionAnswers",
  language: "lumenLanguage",
} as const;

// ─── IndexedDB helpers (used for large blob storage) ─────────────────────────

const _IDB_NAME = "lumenStore";
const _IDB_VERSION = 1;
const _IDB_STORE = "blobs";

function _openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_IDB_NAME, _IDB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(_IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function _idbPut(key: string, value: unknown): Promise<void> {
  const db = await _openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_IDB_STORE, "readwrite");
    tx.objectStore(_IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function _idbGet<T>(key: string): Promise<T | null> {
  const db = await _openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_IDB_STORE, "readonly");
    const req = tx.objectStore(_IDB_STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export type DeliveryMetrics = {
  wpm: number;
  filler_count: number;
  filler_rate: number;
  avg_pause_sec: number;
  longest_silence_sec: number;
  duration_sec: number;
  filler_words_found: string[];
};

export type EmotionMetrics = {
  dominant_emotion: string;
  emotion_distribution: Record<string, number>;
  stability_score: number;
  nervous_rate: number;
  emotion_score: number;
  chunks_analyzed: number;
};

export type VideoEmotionMetrics = {
  dominant_emotion: string;
  emotion_distribution: Record<string, number>;
  stability_score: number;
  nervous_rate: number;
  non_verbal_score: number;
  frames_analyzed: number;
  frames_sampled: number;
};

export type AnalyzeResponse = {
  final_score: number;
  content_score: number;
  delivery_score: number;
  non_verbal_score: number;
  transcription: string;
  content_metrics: ContentMetrics;
  delivery_metrics: DeliveryMetrics;
  emotion_metrics: EmotionMetrics;
  video_emotion_metrics: VideoEmotionMetrics;
  feedback: {
    content: string;
    delivery: string;
    non_verbal: string;
    overall_insight?: string;
    coach_data?: Record<number, unknown>;
  };
  file_name: string;
  file_size_bytes: number;
};

export type FrameDetection = {
  emotion: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number } | null;
};

export type SessionRecord = {
  id: string;
  questionTopic: string;
  date: string;
  result: AnalyzeResponse;
  categoryLabel?: string;
  questions?: string[];
  videoUrls?: string[];
};

export type ContentMetrics = {
  semantic_score: number;
  rubric_score: number;
  completeness_score: number;
  cosine_similarity: number;
  cross_encoder_score: number | null;
  question_text: string;
  behavioral_question: boolean;
};

export type RecordingMeta = {
  mimeType: string;
  durationSec: number;
  recordedAt: string;
  questionText: string;
  questionIndex: number;
};

/** One recorded answer blob stored in IndexedDB. */
export type SessionAnswer = {
  questionIndex: number;
  questionText: string;
  idbKey: string; // key into IndexedDB for the blob
  mimeType: string;
  durationSec: number;
  recordedAt: string;
};

export type CategoryId =
  | "sw-engineer"
  | "data-analyst"
  | "product-mgr"
  | "marketing"
  | "ui-ux"
  | "general";

export type SimulationConfig = {
  categoryId: CategoryId | "custom";
  categoryLabel: string;
  questionTopic: string;
  questions: string[];
  persona?: "friendly" | "strict" | "stress";
  language?: "en" | "id";
};

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  categoryId: "sw-engineer",
  categoryLabel: "SW Engineer",
  questionTopic: "software engineer technical interview debugging system design backend",
  persona: "friendly",
  language: "en",
  questions: [
    "Tell me about a complex technical problem you solved and the trade-offs you considered.",
    "Walk me through how you would debug a slow production API.",
    "How would you design a reliable high-traffic service for an interview scheduling product?",
  ],
};

export const SIMULATION_CATEGORIES: Record<
  "en" | "id",
  Record<CategoryId, Omit<SimulationConfig, "categoryId">>
> = {
  en: {
    "sw-engineer": DEFAULT_SIMULATION_CONFIG,
    "data-analyst": {
      categoryLabel: "Data Analyst",
      questionTopic: "data analyst case interview SQL analytics problem solving",
      questions: [
        "Tell me about an analysis you ran that changed a product or business decision.",
        "How would you investigate a sudden drop in weekly active users?",
        "Describe how you would design a dashboard for leadership to track interview platform health.",
      ],
    },
    "product-mgr": {
      categoryLabel: "Product Manager",
      questionTopic: "product manager behavioral interview leadership stakeholder communication",
      questions: [
        "Tell me about a product decision where you had to balance user needs and business goals.",
        "How would you prioritize features for an interview coaching platform with limited engineering time?",
        "Describe a time you aligned stakeholders who disagreed on product direction.",
      ],
    },
    marketing: {
      categoryLabel: "Marketing",
      questionTopic: "marketing case interview campaign strategy communication",
      questions: [
        "Tell me about a campaign you planned and how you measured whether it worked.",
        "How would you position an AI interview coach for university students?",
        "Describe how you would diagnose a campaign with high clicks but low conversion.",
      ],
    },
    "ui-ux": {
      categoryLabel: "UI / UX",
      questionTopic: "UI UX design portfolio interview product thinking usability",
      questions: [
        "Walk me through a portfolio project and the user problem you were solving.",
        "How would you improve the onboarding flow for a first-time interview practice user?",
        "Tell me about a time usability research changed your design direction.",
      ],
    },
    general: {
      categoryLabel: "General",
      questionTopic: "general job interview introduction communication career goals",
      questions: [
        "Tell me about yourself and what kind of role you are preparing for.",
        "Describe a challenge you faced and how you handled it.",
        "Why are you interested in this opportunity, and what strengths would you bring?",
      ],
    },
  },
  id: {
    "sw-engineer": {
      categoryLabel: "Software Engineer",
      questionTopic: "wawancara teknis software engineer debugging desain sistem backend",
      questions: [
        "Ceritakan masalah teknis kompleks yang pernah Anda selesaikan dan pertimbangan yang Anda ambil.",
        "Coba jelaskan bagaimana Anda akan men-debug API produksi yang berjalan lambat.",
        "Bagaimana Anda merancang layanan lalu lintas tinggi yang andal untuk produk penjadwalan wawancara?",
      ],
    },
    "data-analyst": {
      categoryLabel: "Data Analyst",
      questionTopic: "wawancara kasus data analyst SQL analitik pemecahan masalah",
      questions: [
        "Ceritakan analisis yang Anda lakukan yang berhasil mengubah keputusan produk atau bisnis.",
        "Bagaimana Anda menyelidiki penurunan tiba-tiba pada pengguna aktif mingguan?",
        "Jelaskan bagaimana Anda merancang dasbor untuk pimpinan guna melacak metrik kesehatan platform wawancara.",
      ],
    },
    "product-mgr": {
      categoryLabel: "Product Manager",
      questionTopic: "wawancara manajer produk kepemimpinan komunikasi pemangku kepentingan",
      questions: [
        "Ceritakan tentang keputusan produk di mana Anda harus menyeimbangkan kebutuhan pengguna dan tujuan bisnis.",
        "Bagaimana Anda memprioritaskan fitur untuk platform wawancara AI dengan waktu pengembangan (engineering time) yang terbatas?",
        "Gambarkan pengalaman saat Anda menyelaraskan pemangku kepentingan yang berbeda pendapat tentang arah produk.",
      ],
    },
    marketing: {
      categoryLabel: "Marketing",
      questionTopic: "wawancara kasus pemasaran strategi kampanye komunikasi",
      questions: [
        "Ceritakan tentang kampanye yang Anda rencanakan dan bagaimana Anda mengukur keberhasilannya.",
        "Bagaimana Anda memposisikan pelatih wawancara AI untuk mahasiswa universitas?",
        "Jelaskan bagaimana Anda mendiagnosis kampanye dengan banyak klik tetapi konversi rendah.",
      ],
    },
    "ui-ux": {
      categoryLabel: "UI / UX",
      questionTopic: "wawancara portofolio desain UI UX pemikiran produk kegunaan",
      questions: [
        "Pandu saya melalui proyek portofolio Anda dan masalah pengguna apa yang Anda selesaikan.",
        "Bagaimana Anda meningkatkan alur pendaftaran (onboarding) untuk pengguna baru pada platform wawancara AI ini?",
        "Ceritakan tentang suatu waktu ketika riset pengguna (usability research) mengubah arah desain Anda.",
      ],
    },
    general: {
      categoryLabel: "General",
      questionTopic: "wawancara kerja umum perkenalan komunikasi tujuan karir",
      questions: [
        "Ceritakan tentang diri Anda dan peran apa yang sedang Anda persiapkan.",
        "Gambarkan tantangan yang pernah Anda hadapi dan bagaimana Anda mengatasinya.",
        "Mengapa Anda tertarik dengan peluang ini, dan kekuatan apa yang Anda bawa?",
      ],
    },
  }
};

function _parseSimulationConfig(raw: string | null): SimulationConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SimulationConfig>;
    if (
      typeof parsed.categoryLabel === "string" &&
      typeof parsed.questionTopic === "string" &&
      Array.isArray(parsed.questions) &&
      parsed.questions.every((q) => typeof q === "string")
    ) {
      return {
        categoryId: parsed.categoryId ?? "custom",
        categoryLabel: parsed.categoryLabel,
        questionTopic: parsed.questionTopic,
        questions: parsed.questions,
        persona: parsed.persona ?? "friendly",
        language: parsed.language ?? "en",
      } as SimulationConfig;
    }
  } catch {
    return null;
  }
  return null;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000";

export function getApiBaseUrl(): string {
  return API_BASE;
}

export async function detectFrameEmotion(frameBlob: Blob): Promise<FrameDetection> {
  const form = new FormData();
  form.append("file", frameBlob, "frame.jpg");

  const response = await fetch(`${API_BASE}/api/detect-frame`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    return { emotion: "neutral", confidence: 0, bbox: null };
  }

  return (await response.json()) as FrameDetection;
}

export async function saveRecordingToSession(
  blob: Blob,
  meta: Omit<RecordingMeta, "recordedAt"> & { recordedAt?: string },
): Promise<void> {
  await _idbPut(STORAGE_KEYS.recording, blob);
  const fullMeta: RecordingMeta = {
    mimeType: meta.mimeType,
    durationSec: meta.durationSec,
    recordedAt: meta.recordedAt ?? new Date().toISOString(),
    questionText: meta.questionText,
    questionIndex: meta.questionIndex,
  };
  sessionStorage.setItem(STORAGE_KEYS.recordingMeta, JSON.stringify(fullMeta));
}

/**
 * Save a single answer blob for a given question index.
 * Blobs are stored in IndexedDB under a per-answer key; metadata in sessionStorage.
 */
export async function saveAnswerToSession(
  blob: Blob,
  meta: Omit<SessionAnswer, "idbKey">,
): Promise<void> {
  const idbKey = `lumenAnswer_Q${meta.questionIndex}`;
  await _idbPut(idbKey, blob);
  const answer: SessionAnswer = { ...meta, idbKey };
  const existing = loadSessionAnswers();
  const updated = existing.filter((a) => a.questionIndex !== meta.questionIndex);
  updated.push(answer);
  updated.sort((a, b) => a.questionIndex - b.questionIndex);
  sessionStorage.setItem(STORAGE_KEYS.sessionAnswers, JSON.stringify(updated));
}

/** Load all per-question answer metadata from sessionStorage. */
export function loadSessionAnswers(): SessionAnswer[] {
  const raw = sessionStorage.getItem(STORAGE_KEYS.sessionAnswers);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SessionAnswer[];
  } catch {
    return [];
  }
}

/** Clear all per-question session answers (call before a new interview). */
export function clearSessionAnswers(): void {
  sessionStorage.removeItem(STORAGE_KEYS.sessionAnswers);
}

/** Load the blob for a specific answer by its IndexedDB key. */
export async function loadAnswerBlob(idbKey: string): Promise<Blob | null> {
  return _idbGet<Blob>(idbKey);
}

export async function loadRecordingFromSession(): Promise<{
  blob: Blob;
  meta: RecordingMeta | null;
} | null> {
  const blob = await _idbGet<Blob>(STORAGE_KEYS.recording);
  if (!blob) return null;

  const metaRaw = sessionStorage.getItem(STORAGE_KEYS.recordingMeta);
  let meta: RecordingMeta | null = null;
  if (metaRaw) {
    try {
      meta = JSON.parse(metaRaw) as RecordingMeta;
    } catch {
      meta = null;
    }
  }

  return { blob, meta };
}

export function getQuestionTopic(): string {
  return (
    sessionStorage.getItem(STORAGE_KEYS.questionTopic)?.trim() ||
    "software engineer technical interview problem solving"
  );
}

export function setQuestionTopic(topic: string): void {
  sessionStorage.setItem(STORAGE_KEYS.questionTopic, topic.trim());
}

export function saveSimulationConfig(config: SimulationConfig): void {
  sessionStorage.setItem(STORAGE_KEYS.questionTopic, config.questionTopic.trim());
  sessionStorage.setItem(STORAGE_KEYS.simulationConfig, JSON.stringify(config));
}

export function loadSimulationConfig(): SimulationConfig {
  const config = _parseSimulationConfig(
    sessionStorage.getItem(STORAGE_KEYS.simulationConfig),
  );
  if (config) return config;

  const topic = getQuestionTopic();
  if (topic !== DEFAULT_SIMULATION_CONFIG.questionTopic) {
    return {
      categoryId: "custom",
      categoryLabel: "Custom Topic",
      questionTopic: topic,
      questions: [
        `Introduce your background for this topic: ${topic}.`,
        "Describe a relevant challenge you have handled and the steps you took.",
        "What would you prioritize in your first 30 days for this role or context?",
      ],
    };
  }

  return DEFAULT_SIMULATION_CONFIG;
}

export function saveAnalysisResult(result: AnalyzeResponse): void {
  sessionStorage.setItem(STORAGE_KEYS.analysisResult, JSON.stringify(result));
}

export function loadAnalysisResult(): AnalyzeResponse | null {
  const raw = sessionStorage.getItem(STORAGE_KEYS.analysisResult);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AnalyzeResponse;
    if (!parsed.delivery_metrics.filler_words_found) {
      parsed.delivery_metrics.filler_words_found = [];
    }
    if (!parsed.video_emotion_metrics) {
      parsed.video_emotion_metrics = {
        dominant_emotion: "neutral",
        emotion_distribution: { neutral: 1 },
        stability_score: 1,
        nervous_rate: 0,
        non_verbal_score: parsed.non_verbal_score,
        frames_analyzed: 0,
        frames_sampled: 0,
      };
    }
    if (!parsed.content_metrics) {
      parsed.content_metrics = {
        semantic_score: parsed.content_score,
        rubric_score: parsed.content_score,
        completeness_score: parsed.content_score,
        cosine_similarity: 0,
        cross_encoder_score: null,
        question_text: "",
        behavioral_question: false,
      };
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSessionToHistory(
  result: AnalyzeResponse,
  questionTopic: string,
  videoUrls?: string[]
): void {
  const config = loadSimulationConfig();
  const record: SessionRecord = {
    id: new Date().toISOString(),
    questionTopic,
    date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    result,
    categoryLabel: config.categoryLabel,
    questions: config.questions,
    videoUrls: videoUrls || [],
  };

  const existing = loadSessionHistory();
  const updated = [record, ...existing].slice(0, 50);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(updated));
  selectSession(record);
  
  // Async save to database
  saveUserHistoryToDB(record).catch(console.error);
}

export async function saveUserHistoryToDB(record: SessionRecord) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  await supabase.from("user_history").insert({
    user_id: user.id,
    session_id: record.id,
    question_topic: record.questionTopic,
    category_label: record.categoryLabel,
    date: new Date().toISOString(),
    result: record.result as unknown as Record<string, unknown>,
    questions: record.questions,
    video_urls: record.videoUrls || [],
  });
}

export async function fetchUserHistoryFromDB(): Promise<SessionRecord[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  
  const { data, error } = await supabase
    .from("user_history")
    .select("*")
    .order("created_at", { ascending: false });
    
  if (error || !data) return [];
  
  const records = data.map(row => ({
    id: row.session_id,
    questionTopic: row.question_topic,
    date: new Date(row.date).toISOString().slice(0, 10).replace(/-/g, "."),
    result: row.result as AnalyzeResponse,
    categoryLabel: row.category_label,
    questions: row.questions as string[],
    videoUrls: row.video_urls as string[],
  }));
  
  // Update local storage so synchronous components have the latest data
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(records));
  window.dispatchEvent(new Event("storage"));
  
  return records;
}

export async function deleteSessionHistoryFromDB(record: SessionRecord): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  if (record.videoUrls && record.videoUrls.length > 0) {
    await supabase.storage.from("interview_videos").remove(record.videoUrls).catch(console.error);
  }

  const { error } = await supabase
    .from("user_history")
    .delete()
    .eq("session_id", record.id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to delete session history", error);
    return false;
  }

  await fetchUserHistoryFromDB();
  return true;
}

export function loadSessionHistory(): SessionRecord[] {
  const raw = localStorage.getItem(STORAGE_KEYS.history);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SessionRecord[];
  } catch {
    return [];
  }
}

export function selectSession(record: SessionRecord): void {
  localStorage.setItem(STORAGE_KEYS.selectedSessionId, record.id);
  saveAnalysisResult(record.result);
  
  // Restore simulation config so that report cards and result pages show the correct questions
  saveSimulationConfig({
    categoryId: "custom",
    categoryLabel: record.categoryLabel ?? "Custom Topic",
    questionTopic: record.questionTopic,
    questions: record.questions ?? [],
  });
}

export function loadSelectedSession(sessionId?: string | null): SessionRecord | null {
  const history = loadSessionHistory();
  const selectedId =
    sessionId?.trim() || localStorage.getItem(STORAGE_KEYS.selectedSessionId);
  if (selectedId) {
    const selected = history.find((session) => session.id === selectedId);
    if (selected) {
      return selected;
    }
  }
  return history[0] ?? null;
}

export function resolveRecordingMimeType(
  blobType?: string,
  metaMimeType?: string,
): string {
  return metaMimeType ?? blobType ?? "video/webm";
}

export function recordingUploadFilename(mimeType: string): string {
  const base = mimeType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (base.includes("webm")) return "interview-recording.webm";
  if (base.includes("mp4") || base === "video/quicktime") return "interview-recording.mp4";
  if (base.includes("wav")) return "interview-recording.wav";
  if (base.includes("mpeg") || base.includes("mp3")) return "interview-recording.mp3";
  if (base.includes("ogg")) return "interview-recording.ogg";
  return "interview-recording.webm";
}

export async function analyzeRecording(
  file: Blob,
  options: {
    questionTopic: string;
    questionText: string;
    mimeType?: string;
    language?: string;
  },
): Promise<AnalyzeResponse> {
  const mimeType = resolveRecordingMimeType(file.type, options.mimeType);
  const uploadBlob = file.type ? file : new Blob([file], { type: mimeType });
  const form = new FormData();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  if (user) {
    // Create temporary row to track the async job
    await supabase.from("user_history").insert({
      user_id: user.id,
      session_id: jobId,
      question_topic: options.questionTopic,
      category_label: "Temp Job",
      date: new Date().toISOString(),
      result: null, // PENDING
      questions: [options.questionText],
      video_urls: [],
    });
  }

  form.append("file", uploadBlob, recordingUploadFilename(mimeType));
  form.append("question_text", options.questionText.trim());
  form.append("question_topic", options.questionTopic.trim());
  form.append("job_id", jobId);
  form.append("webhook_url", `${window.location.origin}/api/webhooks/analyze`);
  form.append("language", options.language ?? "en");

  const response = await fetch(`${API_BASE}/api/analyze-async`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    let detail = `Async Analysis failed (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* ignore parse errors */
    }
    if (user) await supabase.from("user_history").delete().eq("session_id", jobId);
    throw new Error(detail);
  }

  if (!user) {
    // If not logged in, we can't use webhooks safely without RLS issues, so fallback to sync if possible.
    // However, our backend now only does async on this endpoint.
    // In our app, users must be logged in to do simulations.
    throw new Error("Must be logged in to process interview.");
  }

  // Wait for webhook to update the row
  return new Promise((resolve, reject) => {
    let isDone = false;

    const cleanup = async () => {
      isDone = true;
      channel.unsubscribe();
      clearInterval(interval);
      await supabase.from("user_history").delete().eq("session_id", jobId);
    };

    const channel = supabase
      .channel(`realtime_${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_history",
          filter: `session_id=eq.${jobId}`,
        },
        async (payload) => {
          if (isDone) return;
          const updatedRow = payload.new;
          if (updatedRow.result) {
            await cleanup();
            if (updatedRow.result.is_error) {
              reject(new Error(updatedRow.result.message || "Analysis failed"));
            } else {
              resolve(updatedRow.result as AnalyzeResponse);
            }
          }
        }
      )
      .subscribe();

    // Polling fallback every 3 seconds
    const interval = setInterval(async () => {
      if (isDone) return;
      const { data } = await supabase
        .from("user_history")
        .select("result")
        .eq("session_id", jobId)
        .single();
        
      if (data && data.result) {
        await cleanup();
        const resultData = data.result as Record<string, unknown>;
        if (resultData.is_error) {
          reject(new Error(String(resultData.message) || "Analysis failed"));
        } else {
          resolve(data.result as AnalyzeResponse);
        }
      }
    }, 3000);
  });
}

export function performanceLabel(score: number): string {
  if (score >= 85) return "Strong performance";
  if (score >= 70) return "Solid performance";
  if (score >= 55) return "Room to improve";
  return "Needs work";
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function emotionBorderColor(emotion: string): string {
  const e = emotion.toLowerCase();
  if (e === "happy" || e === "neutral" || e === "surprise" || e === "surprised") {
    return "#3a8377";
  }
  if (e === "sad" || e === "angry" || e === "fear" || e === "fearful" || e === "disgust") {
    return "#c75240";
  }
  return "#c9a227";
}
