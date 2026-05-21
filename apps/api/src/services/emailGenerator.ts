import Anthropic from "@anthropic-ai/sdk";
import prisma from "../lib/prisma.js";
import { config } from "../config.js";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey || "dummy-key-to-allow-init",
});

export interface EnrichedCompanyData {
  companyId: string;
  name: string;
  description: string;
  techStack: string[];
  founderName: string;
  founderTitle: string;
  recentFundingAmount: string | null;
}

/**
 * Generates an LLM-powered cold email and saves it to the Prospect table.
 */
export async function generateColdEmail(data: EnrichedCompanyData): Promise<void> {
  const { companyId, name, description, techStack, founderName, recentFundingAmount } = data;

  const prompt = `
You are an expert at writing personalized, highly effective cold emails.
Write a cold email from the perspective of a talented CS student seeking an internship.

TARGET COMPANY:
- Company Name: ${name}
- Founder Name: ${founderName}
- Company Description: ${description}
- Tech Stack: ${techStack.join(", ")}
- Recent Funding: ${recentFundingAmount || "Not specified"}

REQUIREMENTS:
1. Reference the company's specific tech stack (e.g. "I saw you're building on...").
2. Reference their product mission based on the description.
3. If recent funding is specified, use that milestone as a hook (e.g. "Congrats on the recent ${recentFundingAmount} raise...").
4. EXPLICITLY FORBIDDEN: Do not use generic phrases like "I hope this email finds you well".
5. Keep it concise, engaging, and professional.

OUTPUT FORMAT:
Return ONLY a valid JSON object with the following keys:
- "subject": The subject line of the email.
- "body": The full body of the email.
Do not wrap the JSON in markdown fences.
  `.trim();

  // Call the Anthropic API
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const responseText = msg.content[0].type === "text" ? msg.content[0].text : "";

  // Parse the JSON response safely (strip markdown fences if present)
  let parsedEmail: { subject: string; body: string };
  try {
    const jsonStr = responseText.replace(/^```(json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    parsedEmail = JSON.parse(jsonStr);
  } catch (err) {
    console.error("Failed to parse LLM response as JSON:", responseText);
    throw new Error("Invalid JSON response from LLM");
  }

  // Update the Prospect table
  // Assuming a Prospect was already created for this company in the previous step
  await prisma.prospect.updateMany({
    where: { companyId },
    data: {
      generatedEmail: JSON.stringify(parsedEmail),
      status: "PENDING",
    },
  });
}
