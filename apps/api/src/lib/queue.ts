// ═══════════════════════════════════════════════
// BullMQ Queue Definitions
// ═══════════════════════════════════════════════

import { Queue } from "bullmq";
import { redis } from "./redis.js";

export const enrichQueue = new Queue("enrich-company", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const emailGenerateQueue = new Queue("generate-email", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const emailSendQueue = new Queue("send-email", {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 1000 },
  },
});

export const scrapeQueue = new Queue("scrape-startups", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 10000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 200 },
  },
});

// ─── Enrichment Queue (aggregator pipeline) ────
export const enrichmentQueue = new Queue("enrichment", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

// ─── Aggregation Pipeline Queue (24h repeatable) ─
export const aggregationQueue = new Queue("aggregation-pipeline", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 30000 },
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 100 },
  },
});

/**
 * Register the daily repeatable aggregation job in BullMQ.
 * Using a constant jobId ensures it is only registered once.
 */
export async function scheduleAggregationJob() {
  await aggregationQueue.add(
    "daily-aggregation",
    {}, 
    {
      repeat: {
        every: 24 * 60 * 60 * 1000, 
      },
      jobId: "daily-aggregation", 
    }
  );
  console.log("⏰ Repeatable job scheduled: aggregation-pipeline every 24h");
}
