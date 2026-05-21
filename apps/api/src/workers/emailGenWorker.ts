import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis.js";
import prisma from "../lib/prisma.js";
import { generateColdEmail } from "../services/emailGenerator.js";
import type { GenerateEmailJobData } from "@internhunter/types";

// ─── Generate Email Worker ─────────────────────
// Listens to the email-generation queue (mapped to "generate-email" BullMQ queue)
// and processes jobs by generating personalized cold emails using the Anthropic API.
// ─────────────────────────────────────────────

export const emailGenWorker = new Worker<GenerateEmailJobData>(
  "generate-email",
  async (job: Job<GenerateEmailJobData>) => {
    const { companyId, prospectId } = job.data;
    console.log(`\n✉️  [emailGenWorker] Job ${job.id} — Generating email for prospect ${prospectId}`);

    try {
      // 1. Fetch enriched company and founder data
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: { founders: true },
      });

      if (!company) {
        throw new Error(`Company ${companyId} not found in DB`);
      }

      const founder = company.founders[0];
      const founderName = founder?.name || "Founder";
      const founderTitle = founder?.title || "Team Member";

      // 2. Call the email generator service
      await generateColdEmail({
        companyId: company.id,
        name: company.name,
        description: company.description,
        techStack: company.techStack,
        founderName,
        founderTitle,
        recentFundingAmount: company.fundingAmount,
      });

      console.log(`✅ [emailGenWorker] Job ${job.id} complete — email generated for prospect ${prospectId}\n`);
      return { prospectId, companyId, generated: true };
    } catch (error) {
      console.error(`❌ [emailGenWorker] Error generating email for prospect ${prospectId}:`, (error as Error).message);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

// Event Listeners for logging and error handling
emailGenWorker.on("failed", (job, err) => {
  console.error(`❌ [emailGenWorker] Job ${job?.id} failed:`, err.message);
});

emailGenWorker.on("completed", (job) => {
  console.log(`✅ [emailGenWorker] Job ${job.id} completed successfully`);
});
