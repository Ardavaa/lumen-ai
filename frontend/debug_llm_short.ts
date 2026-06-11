import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

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

async function main() {
  try {
    const result = await generateObject({
      model: google("gemma-4-31b-it"),
      schema: coachSchema,
      maxOutputTokens: 1000,
      temperature: 0.2,
      system: "You are an expert interview coach analyzing a candidate's answer. Provide highly constructive feedback. IMPORTANT: You must respond ONLY with raw, valid JSON. Do NOT wrap your response in markdown code blocks (no ```json). Do NOT include any introductory or concluding text. Your response must start with '{' and end with '}'.",
      prompt: `The candidate achieved the following overall scores in their interview simulation:
  - Overall Score: 20/100
  - Content Quality: 10/100
  - Delivery & Fluency: 20/100
  - Non-Verbal Presence: 30/100
  
  Question asked: "Can you walk me through a specific time when you had to manage a conflict within a team during a high-pressure situation?"
  Candidate's answer: "emang kerasi pokoknya"
  
  Analyze the candidate's answer taking into account their overall performance context. Provide structured, actionable coaching.`,
    });

    console.log("SUCCESS:", result.object);
  } catch (error) {
    console.error("SDK Error:", error);
  }
}

main();
