"use server";

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { jsonrepair } from "jsonrepair";

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

function extractAndRepairJSON(text: string) {
  let cleanText = text.trim();
  // Strip markdown code fences if present (e.g. ```json ... ```)
  const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (match && match[1]) {
    cleanText = match[1].trim();
  }
  
  try {
    // jsonrepair fixes trailing commas, missing quotes, single quotes, etc.
    const repaired = jsonrepair(cleanText);
    return JSON.parse(repaired);
  } catch (err) {
    console.error("JSON Repair failed. Original text:", text, "Error:", err);
    throw new Error("AI returned malformed data that could not be repaired.");
  }
}

export async function askAICoach(
  questionText: string, 
  transcript: string,
  context: {
    finalScore: number;
    contentScore: number;
    deliveryScore: number;
    nonVerbalScore: number;
  }
): Promise<CoachResult> {
  const result = await generateText({
    model: google("gemma-4-26b-a4b-it"),
    maxTokens: 1000,
    temperature: 0.2,
    system: "You are an expert interview coach analyzing a candidate's answer. Provide highly constructive feedback.",
    prompt: `The candidate achieved the following overall scores in their interview simulation:
- Overall Score: ${context.finalScore}/100
- Content Quality: ${context.contentScore}/100
- Delivery & Fluency: ${context.deliveryScore}/100
- Non-Verbal Presence: ${context.nonVerbalScore}/100

Question asked: "${questionText}"
Candidate's answer: "${transcript}"

Analyze the candidate's answer taking into account their overall performance context. Provide structured, actionable coaching.

CRITICAL INSTRUCTION: You MUST return your response as ONLY raw valid JSON matching this exact structure, with no markdown formatting or extra text outside the JSON:
{
  "rewrite": {
    "originalTextExcerpt": "snippet from answer",
    "improvedAnswer": "better version",
    "reasoning": "why it is better"
  },
  "coaching": {
    "strengths": ["str1", "str2"],
    "weaknesses": ["weak1", "weak2"],
    "tips": ["tip1"]
  }
}`,
  });

  const parsed = extractAndRepairJSON(result.text);
  return coachSchema.parse(parsed);
}

export async function generateInterviewQuestions(
  role: string,
  company: string,
  count: number = 3,
  persona: "friendly" | "strict" | "stress" = "friendly"
): Promise<string[]> {
  const personas = {
    friendly: "You are a friendly, supportive, and relaxed HR interviewer. You focus on culture fit, team collaboration, and bringing out the best in the candidate.",
    strict: "You are a strict, direct, and highly technical Lead Engineer interviewer. You focus on precise details, technical depth, and efficiency.",
    stress: "You are a stress-tester interviewer. You are skeptical, pressure-inducing, and challenging. Your goal is to see how the candidate handles difficult situations."
  };

  const systemPrompt = `You are an expert interviewer. ${personas[persona]} Each question must be short, direct, and distinct.`;

  const result = await generateText({
    model: google("gemma-4-26b-a4b-it"),
    maxTokens: 500,
    temperature: 0.7,
    system: systemPrompt,
    prompt: `Generate EXACTLY ${count} discrete interview questions for a candidate applying for the role of "${role}" at "${company}". 
    The questions should be a mix of behavioral and technical/role-specific, directly relevant to the role and the company's domain.
    
    CRITICAL INSTRUCTION: You MUST return your response as ONLY raw valid JSON matching this exact structure, with no extra text:
    {
      "questions": [
        "Question 1 here?",
        "Question 2 here?",
        "Question 3 here?"
      ]
    }`,
  });

  const parsed = extractAndRepairJSON(result.text);
  const schema = z.object({ questions: z.array(z.string()) });
  return schema.parse(parsed).questions;
}

export async function generateFollowUpQuestion(
  role: string,
  company: string,
  persona: "friendly" | "strict" | "stress",
  previousQuestion: string,
  candidateAnswer: string
): Promise<string> {
  const personas = {
    friendly: "You are a friendly, supportive, and relaxed HR interviewer. You focus on culture fit, team collaboration, and bringing out the best in the candidate.",
    strict: "You are a strict, direct, and highly technical Lead Engineer interviewer. You focus on precise details, technical depth, and efficiency.",
    stress: "You are a stress-tester interviewer. You are skeptical, pressure-inducing, and challenging. Your goal is to see how the candidate handles difficult situations."
  };

  const systemPrompt = `You are an expert interviewer. ${personas[persona]} You must ask a single short, direct, and highly relevant follow-up question based on the candidate's answer.`;

  const result = await generateText({
    model: google("gemma-4-26b-a4b-it"),
    maxTokens: 200,
    temperature: 0.5,
    system: systemPrompt,
    prompt: `The candidate is applying for "${role}" at "${company}".
    
    You previously asked: "${previousQuestion}"
    The candidate answered: "${candidateAnswer}"
    
    Generate EXACTLY ONE concise follow-up question. The question should dig deeper into what they just said, challenge a point they made, or ask for a specific example based on their answer. Do not acknowledge their answer with "Good answer" or similar.
    
    CRITICAL INSTRUCTION: You MUST return your response as ONLY raw valid JSON matching this exact structure, with no extra text:
    {
      "question": "Your follow up question here?"
    }`,
  });

  const parsed = extractAndRepairJSON(result.text);
  const schema = z.object({ question: z.string() });
  return schema.parse(parsed).question;
}
