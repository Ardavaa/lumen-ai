"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const coachSchema = z.object({
  rewrite: z.object({
    originalTextExcerpt: z.string().describe("A snippet of what the user actually said that needs improvement."),
    improvedAnswer: z.string().describe("How they should have phrased it (cleaner, STAR method)."),
    reasoning: z.string().describe("Why the new phrasing is better."),
  }),
  coaching: z.object({
    strengths: z.array(z.string()).describe("List of 2 things they did well."),
    weaknesses: z.array(z.string()).describe("List of 2 things they need to fix."),
    tips: z.array(z.string()).describe("One actionable pro-tip for next time."),
  }),
});

export type CoachResult = z.infer<typeof coachSchema>;

export async function askAICoach(
  questionText: string, 
  transcript: string,
  context: {
    finalScore: number;
    contentScore: number;
    deliveryScore: number;
    nonVerbalScore: number;
  },
  language: string = "en"
): Promise<CoachResult> {
  const result = await generateObject({
    model: google("gemma-4-31b-it"),
    schema: coachSchema,
    maxOutputTokens: 1000,
    temperature: 0.2,
    system: `You are an expert interview coach analyzing a candidate's answer. Provide highly constructive feedback. IMPORTANT: You must respond ONLY with raw, valid JSON. Do NOT wrap your response in markdown code blocks (no \`\`\`json). Do NOT include any introductory or concluding text. Your response must start with '{' and end with '}'. All your textual feedback must be written in ${language === 'id' ? 'Indonesian (Bahasa Indonesia)' : 'English'}.`,
    prompt: `The candidate achieved the following overall scores in their interview simulation:
- Overall Score: ${context.finalScore}/100
- Content Quality: ${context.contentScore}/100
- Delivery & Fluency: ${context.deliveryScore}/100
- Non-Verbal Presence: ${context.nonVerbalScore}/100

Question asked: "${questionText}"
Candidate's answer: "${transcript}"

Analyze the candidate's answer taking into account their overall performance context. Provide structured, actionable coaching. The coaching MUST be generated in ${language === 'id' ? 'Indonesian (Bahasa Indonesia)' : 'English'}.`,
  });

  return result.object;
}

export async function generateInterviewQuestions(
  role: string,
  company: string,
  count: number = 3,
  persona: "friendly" | "strict" | "stress" = "friendly",
  language: string = "en"
): Promise<string[]> {
  const personasEn = {
    friendly: "You are a friendly, supportive, and relaxed HR interviewer. You focus on culture fit, team collaboration, and bringing out the best in the candidate.",
    strict: "You are a strict, direct, and highly technical Lead Engineer interviewer. You focus on precise details, technical depth, and efficiency.",
    stress: "You are a stress-tester interviewer. You are skeptical, pressure-inducing, and challenging. Your goal is to see how the candidate handles difficult situations."
  };

  const personasId = {
    friendly: "Anda adalah pewawancara HR yang ramah, suportif, dan santai. Anda fokus pada kecocokan budaya, kolaborasi tim, dan memunculkan yang terbaik dari kandidat.",
    strict: "Anda adalah pewawancara Lead Engineer yang ketat, blak-blakan, dan sangat teknis. Anda fokus pada detail yang presisi, kedalaman teknis, dan efisiensi.",
    stress: "Anda adalah pewawancara penguji-tekanan (stress-tester). Anda skeptis, memberikan tekanan, dan menantang. Tujuan Anda adalah melihat bagaimana kandidat menangani situasi sulit."
  };

  const systemPrompt = language === 'id'
    ? `Anda adalah pewawancara ahli. ${personasId[persona]} Setiap pertanyaan harus singkat, langsung, dan berbeda. PENTING: Anda hanya boleh merespons dengan JSON mentah yang valid. JANGAN gunakan blok kode markdown (tanpa \`\`\`json). JANGAN sertakan teks pengantar atau penutup. Semua pertanyaan Anda HARUS ditulis murni dalam Bahasa Indonesia.`
    : `You are an expert interviewer. ${personasEn[persona]} Each question must be short, direct, and distinct. IMPORTANT: You must respond ONLY with raw, valid JSON. Do NOT wrap your response in markdown code blocks (no \`\`\`json). Do NOT include any introductory or concluding text. All your questions must be written in English.`;

  const schema = z.object({ 
    questions: z.array(z.string().describe(language === 'id' ? 'Pertanyaan wawancara dalam Bahasa Indonesia.' : 'The interview question in English.')) 
  });

  const promptText = language === 'id'
    ? `Buat TEPAT ${count} pertanyaan wawancara untuk kandidat yang melamar peran "${role}" di perusahaan "${company}".\nPertanyaan harus berupa campuran perilaku dan teknis/spesifik peran, yang relevan dengan posisi tersebut.\nKRITIKAL: SETIAP PERTANYAAN dalam array HARUS sepenuhnya dalam Bahasa Indonesia. JANGAN gunakan bahasa Inggris sama sekali.`
    : `Generate EXACTLY ${count} discrete interview questions for a candidate applying for the role of "${role}" at "${company}".\nThe questions should be a mix of behavioral and technical/role-specific, directly relevant to the role and the company's domain.\nCRITICAL: EVERY SINGLE QUESTION in the array MUST be completely translated into English.`;

  const result = await generateObject({
    model: google("gemma-4-31b-it"),
    schema: schema,
    maxOutputTokens: 500,
    temperature: 0.7,
    system: systemPrompt,
    prompt: promptText,
  });

  return result.object.questions;
}

export async function generateFollowUpQuestion(
  role: string,
  company: string,
  persona: "friendly" | "strict" | "stress",
  previousQuestion: string,
  candidateAnswer: string,
  language: string = "en"
): Promise<string> {
  const personasEn = {
    friendly: "You are a friendly, supportive, and relaxed HR interviewer. You focus on culture fit, team collaboration, and bringing out the best in the candidate.",
    strict: "You are a strict, direct, and highly technical Lead Engineer interviewer. You focus on precise details, technical depth, and efficiency.",
    stress: "You are a stress-tester interviewer. You are skeptical, pressure-inducing, and challenging. Your goal is to see how the candidate handles difficult situations."
  };

  const personasId = {
    friendly: "Anda adalah pewawancara HR yang ramah, suportif, dan santai. Anda fokus pada kecocokan budaya, kolaborasi tim, dan memunculkan yang terbaik dari kandidat.",
    strict: "Anda adalah pewawancara Lead Engineer yang ketat, blak-blakan, dan sangat teknis. Anda fokus pada detail yang presisi, kedalaman teknis, dan efisiensi.",
    stress: "Anda adalah pewawancara penguji-tekanan (stress-tester). Anda skeptis, memberikan tekanan, dan menantang. Tujuan Anda adalah melihat bagaimana kandidat menangani situasi sulit."
  };

  const systemPrompt = language === 'id'
    ? `Anda adalah pewawancara ahli. ${personasId[persona]} Anda harus menanyakan satu pertanyaan lanjutan yang singkat, langsung, dan sangat relevan berdasarkan jawaban kandidat. PENTING: Anda hanya boleh merespons dengan JSON mentah yang valid. JANGAN gunakan blok kode markdown (tanpa \`\`\`json). JANGAN sertakan teks pengantar atau penutup. Pertanyaan harus dibuat murni dalam Bahasa Indonesia.`
    : `You are an expert interviewer. ${personasEn[persona]} You must ask a single short, direct, and highly relevant follow-up question based on the candidate's answer. IMPORTANT: You must respond ONLY with raw, valid JSON. Do NOT wrap your response in markdown code blocks (no \`\`\`json). Do NOT include any introductory or concluding text. The question must be generated in English.`;

  const schema = z.object({ 
    question: z.string().describe(language === 'id' ? 'Pertanyaan lanjutan dalam Bahasa Indonesia.' : 'The follow-up question in English.') 
  });

  const promptText = language === 'id'
    ? `Kandidat melamar posisi "${role}" di perusahaan "${company}".\n\nAnda sebelumnya bertanya: "${previousQuestion}"\nKandidat menjawab: "${candidateAnswer}"\n\nBuat TEPAT SATU pertanyaan lanjutan yang ringkas. Pertanyaan tersebut harus menggali lebih dalam apa yang baru saja mereka katakan, menantang poin yang mereka buat, atau meminta contoh spesifik berdasarkan jawaban mereka. Jangan beri tanggapan seperti "Jawaban yang bagus" atau sejenisnya.\nKRITIKAL: Pertanyaan yang dihasilkan HARUS sepenuhnya dalam Bahasa Indonesia. JANGAN gunakan bahasa Inggris.`
    : `The candidate is applying for "${role}" at "${company}".\n\nYou previously asked: "${previousQuestion}"\nThe candidate answered: "${candidateAnswer}"\n\nGenerate EXACTLY ONE concise follow-up question. The question should dig deeper into what they just said, challenge a point they made, or ask for a specific example based on their answer. Do not acknowledge their answer with "Good answer" or similar.\nCRITICAL: The generated question MUST be completely translated into English.`;

  const result = await generateObject({
    model: google("gemma-4-31b-it"),
    schema: schema,
    maxOutputTokens: 200,
    temperature: 0.5,
    system: systemPrompt,
    prompt: promptText,
  });

  return result.object.question;
}
