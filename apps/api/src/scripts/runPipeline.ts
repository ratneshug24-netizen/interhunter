import { runAggregationPipeline } from "../services/aggregator/index.js";
import { enrichmentQueue, emailGenerateQueue } from "../lib/queue.js";
import prisma from "../lib/prisma.js";
import { Queue } from "bullmq";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForQueueToDrain(queue: Queue, queueName: string) {
  console.log(`\n⏳ Waiting for ${queueName} queue to drain...`);
  while (true) {
    const active = await queue.getActiveCount();
    const waiting = await queue.getWaitingCount();
    const delayed = await queue.getDelayedCount();
    const totalPending = active + waiting + delayed;

    if (totalPending === 0) {
      console.log(`✅ ${queueName} queue drained.`);
      break;
    }

    process.stdout.write(`   [${queueName}] Pending jobs: ${totalPending} (active: ${active}, waiting: ${waiting}, delayed: ${delayed})\r`);
    await delay(2000);
  }
}

async function runPipeline() {
  console.log("🚀 Starting E2E Pipeline manually...");

  try {
    // 1. Run Aggregator
    console.log("\n📡 Running Aggregation Pipeline...");
    await runAggregationPipeline();

    // 2. Wait for Enrichment Queue
    await waitForQueueToDrain(enrichmentQueue, "Enrichment");

    // 3. Wait for Email Generation Queue
    await waitForQueueToDrain(emailGenerateQueue, "Email Generation");

    // 4. Gather Stats
    console.log("\n📊 Gathering Results...");
    
    const totalCompanies = await prisma.company.count();
    const enrichedCompanies = await prisma.company.count({
      where: { techStack: { isEmpty: false } }
    });
    const pendingProspects = await prisma.prospect.count({
      where: { status: "PENDING" }
    });

    // Check failed jobs for any issues
    const enrichFailed = await enrichmentQueue.getFailedCount();
    const emailFailed = await emailGenerateQueue.getFailedCount();

    const summary = [
      { Metric: "Total Companies Found", Value: totalCompanies },
      { Metric: "Companies Enriched", Value: enrichedCompanies },
      { Metric: "Pending Emails Generated", Value: pendingProspects },
      { Metric: "Enrichment Failures", Value: enrichFailed },
      { Metric: "Email Generation Failures", Value: emailFailed },
    ];

    console.table(summary);
    console.log("\n🎉 E2E Pipeline completed successfully!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Pipeline failed:", error);
    process.exit(1);
  }
}

runPipeline();
