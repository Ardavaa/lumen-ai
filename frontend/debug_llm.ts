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
      system: "You are an expert interview coach analyzing a candidate's answer. Provide highly constructive feedback.",
      prompt: `The candidate achieved the following overall scores in their interview simulation:
  - Overall Score: 80/100
  - Content Quality: 85/100
  - Delivery & Fluency: 75/100
  - Non-Verbal Presence: 80/100
  
  Question asked: "Tell me about a time you faced a difficult challenge."
  Candidate's answer: "I had a hard time but I pushed through."
  
  Analyze the candidate's answer taking into account their overall performance context. Provide structured, actionable coaching.`,
    });

    console.log("SUCCESS:", result.object);
  } catch (error: any) {
    console.error("SDK Error Name:", error.name);
    console.error("SDK Error Message:", error.message);
    if (error.text) {
      console.log("=== RAW TEXT THAT FAILED ===");
      console.log(error.text);
      console.log("============================");
    } else if (error.cause) {
        console.log("=== ERROR CAUSE ===");
        console.log(error.cause);
    } else {
        console.log(error);
    }
  }
}

main();
