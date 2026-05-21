// ═══════════════════════════════════════════════
// BullMQ Workers
// ═══════════════════════════════════════════════

import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis.js";
import { aggregationQueue } from "../lib/queue.js";
import prisma from "../lib/prisma.js";
import { runAggregationPipeline } from "../services/aggregator/index.js";
import type {
  EnrichCompanyJobData,
  GenerateEmailJobData,
  SendEmailJobData,
} from "@internhunter/types";

// ─── Enrich Company Worker ─────────────────────
export const enrichWorker = new Worker(
  "enrich-company",
  async (job: Job<EnrichCompanyJobData>) => {
    const { companyId, domain } = job.data;
    console.log(`🔍 Enriching company: ${domain} (${companyId})`);

    // TODO: Integrate with Clearbit, Crunchbase, or similar API
    // For now, simulate enrichment with a delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await prisma.company.update({
      where: { id: companyId },
      data: {
        description: `Enriched data for ${domain} — integrate real enrichment API here.`,
      },
    });

    console.log(`✅ Enrichment complete for ${domain}`);
    return { companyId, enriched: true };
  },
  { connection: redis, concurrency: 5 }
);

// ─── Enrichment Worker (real implementation) ───
// Imported from its own module — handles BuiltWith,
// Hunter.io, and Crunchbase enrichment with
// Promise.allSettled and dead-letter handling.
import { enrichmentWorker } from "./enrichmentWorker.js";

// ─── Generate Email Worker ─────────────────────
import { emailGenWorker } from "./emailGenWorker.js";

// ─── Send Email Worker ─────────────────────────
export const emailSendWorker = new Worker(
  "send-email",
  async (job: Job<SendEmailJobData>) => {
    const { prospectId, recipientEmail, subject, body } = job.data;
    console.log(`📤 Sending email to ${recipientEmail} for prospect: ${prospectId}`);

    // TODO: Integrate with SendGrid, Resend, or AWS SES
    // For now, simulate sending
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(`   Subject: ${subject}`);
    console.log(`   To: ${recipientEmail}`);
    console.log(`   Body length: ${body.length} chars`);

    await prisma.prospect.update({
      where: { id: prospectId },
      data: { status: "SENT" },
    });

    console.log(`✅ Email sent for prospect: ${prospectId}`);
    return { prospectId, sent: true };
  },
  { connection: redis, concurrency: 2 }
);

// ─── Aggregation Pipeline Worker (24h cron) ────
export const aggregationWorker = new Worker(
  "aggregation-pipeline",
  async (job: Job) => {
    console.log(`\n🔄 [aggregationWorker] Job ${job.id} — running full pipeline…`);
    const result = await runAggregationPipeline();
    return result;
  },
  { connection: redis, concurrency: 1 } // Only one aggregation at a time
);

// ─── Worker Event Listeners ────────────────────
[enrichWorker, enrichmentWorker, emailGenWorker, emailSendWorker, aggregationWorker].forEach(
  (worker) => {
    worker.on("completed", (job) => {
      console.log(`✅ Job ${job.id} (${job.name}) on "${worker.name}" completed`);
    });

    worker.on("failed", (job, err) => {
      console.error(
        `❌ Job ${job?.id} (${job?.name}) on "${worker.name}" failed:`,
        err.message
      );
    });
  }
);

/**
 * Start all workers and schedule the aggregation cron.
 */
export async function startWorkers(): Promise<void> {
  console.log("⚙️  BullMQ workers started:");
  console.log("   • enrich-company           (concurrency: 5)");
  console.log("   • enrichment (aggregator)   (concurrency: 5)");
  console.log("   • generate-email            (concurrency: 3)");
  console.log("   • send-email                (concurrency: 2)");
  console.log("   • aggregation-pipeline      (concurrency: 1)");

  // ── Schedule repeatable aggregation job (every 24h) ──
  const { scheduleAggregationJob } = await import("../lib/queue.js");
  await scheduleAggregationJob();
}
