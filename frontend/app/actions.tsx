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
  const personas = {
    friendly: "You are a friendly, supportive, and relaxed HR interviewer. You focus on culture fit, team collaboration, and bringing out the best in the candidate.",
    strict: "You are a strict, direct, and highly technical Lead Engineer interviewer. You focus on precise details, technical depth, and efficiency.",
    stress: "You are a stress-tester interviewer. You are skeptical, pressure-inducing, and challenging. Your goal is to see how the candidate handles difficult situations."
  };

  const systemPrompt = `You are an expert interviewer. ${personas[persona]} Each question must be short, direct, and distinct. IMPORTANT: You must respond ONLY with raw, valid JSON. Do NOT wrap your response in markdown code blocks (no \`\`\`json). Do NOT include any introductory or concluding text. All your questions must be written in ${language === 'id' ? 'Indonesian (Bahasa Indonesia)' : 'English'}.`;

  const schema = z.object({ questions: z.array(z.string()) });

  const result = await generateObject({
    model: google("gemma-4-31b-it"),
    schema: schema,
    maxOutputTokens: 500,
    temperature: 0.7,
    system: systemPrompt,
    prompt: `Generate EXACTLY ${count} discrete interview questions for a candidate applying for the role of "${role}" at "${company}". 
    The questions should be a mix of behavioral and technical/role-specific, directly relevant to the role and the company's domain. The generated questions MUST be in ${language === 'id' ? 'Indonesian (Bahasa Indonesia)' : 'English'}.`,
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
  const personas = {
    friendly: "You are a friendly, supportive, and relaxed HR interviewer. You focus on culture fit, team collaboration, and bringing out the best in the candidate.",
    strict: "You are a strict, direct, and highly technical Lead Engineer interviewer. You focus on precise details, technical depth, and efficiency.",
    stress: "You are a stress-tester interviewer. You are skeptical, pressure-inducing, and challenging. Your goal is to see how the candidate handles difficult situations."
  };

  const systemPrompt = `You are an expert interviewer. ${personas[persona]} You must ask a single short, direct, and highly relevant follow-up question based on the candidate's answer. IMPORTANT: You must respond ONLY with raw, valid JSON. Do NOT wrap your response in markdown code blocks (no \`\`\`json). Do NOT include any introductory or concluding text. The question must be generated in ${language === 'id' ? 'Indonesian (Bahasa Indonesia)' : 'English'}.`;

  const schema = z.object({ question: z.string() });

  const result = await generateObject({
    model: google("gemma-4-31b-it"),
    schema: schema,
    maxOutputTokens: 200,
    temperature: 0.5,
    system: systemPrompt,
    prompt: `The candidate is applying for "${role}" at "${company}".
    
    You previously asked: "${previousQuestion}"
    The candidate answered: "${candidateAnswer}"
    
    Generate EXACTLY ONE concise follow-up question. The question should dig deeper into what they just said, challenge a point they made, or ask for a specific example based on their answer. Do not acknowledge their answer with "Good answer" or similar.`,
  });

  return result.object.question;
}
