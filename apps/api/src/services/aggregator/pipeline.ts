// ═══════════════════════════════════════════════
// Aggregation Pipeline — Orchestrator
// ═══════════════════════════════════════════════
//
// Coordinates the full discovery cycle:
//   1. Run all three scrapers concurrently
//   2. Merge results
//   3. Feed into detector for dedup + scoring
//   4. Return telemetry
// ═══════════════════════════════════════════════

import type { RawCompany, AggregationResult } from "@internhunter/types";
import { scrapeYCStartups } from "./ycScraper.js";
import { scrapeCrunchbase } from "./crunchbaseScraper.js";
import { scrapeProductHunt } from "./productHuntScraper.js";
import { detectAndPersist } from "./detector.js";

/**
 * Run a scraper and catch errors so one failure
 * doesn't kill the entire pipeline.
 */
async function safeScrape(
  label: string,
  scraperFn: () => Promise<RawCompany[]>,
  errors: string[]
): Promise<RawCompany[]> {
  try {
    return await scraperFn();
  } catch (err) {
    const msg = `${label} failed: ${(err as Error).message}`;
    console.error(`❌ [pipeline] ${msg}`);
    errors.push(msg);
    return [];
  }
}

/**
 * Execute the full aggregation pipeline.
 *
 * This is the single entry point called by both
 * the BullMQ repeatable worker and any manual trigger.
 */
export async function runAggregationPipeline(): Promise<AggregationResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  console.log("\n═══════════════════════════════════════════");
  console.log("🚀 [pipeline] Starting aggregation run…");
  console.log("═══════════════════════════════════════════\n");

  // ── 1. Run all scrapers concurrently ─────────
  const [ycResults, cbResults, phResults] = await Promise.all([
    safeScrape("ycScraper", scrapeYCStartups, errors),
    safeScrape("crunchbaseScraper", scrapeCrunchbase, errors),
    safeScrape("productHuntScraper", scrapeProductHunt, errors),
  ]);

  console.log("\n📊 [pipeline] Scraper results:");
  console.log(`   • YC (Work at a Startup): ${ycResults.length}`);
  console.log(`   • Crunchbase:             ${cbResults.length}`);
  console.log(`   • Product Hunt:           ${phResults.length}`);

  // ── 2. Merge ─────────────────────────────────
  const merged: RawCompany[] = [...ycResults, ...cbResults, ...phResults];
  console.log(`   • Total merged:           ${merged.length}\n`);

  if (merged.length === 0) {
    console.log("⚠️  [pipeline] No companies scraped. Ending run.");
    return {
      scrapedCount: 0,
      newCompanies: 0,
      primeTargets: 0,
      enrichmentJobsQueued: 0,
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  // ── 3. Detect, score, persist, enqueue ───────
  const detectorResult = await detectAndPersist(merged);

  const durationMs = Date.now() - startTime;

  const result: AggregationResult = {
    scrapedCount: merged.length,
    newCompanies: detectorResult.persistedCount,
    primeTargets: detectorResult.newCompanies.filter((c) => c.isPrimeTarget)
      .length,
    enrichmentJobsQueued: detectorResult.enrichmentJobsQueued,
    errors,
    durationMs,
  };

  console.log("\n═══════════════════════════════════════════");
  console.log("✅ [pipeline] Aggregation run complete");
  console.log(`   Scraped:       ${result.scrapedCount}`);
  console.log(`   New:           ${result.newCompanies}`);
  console.log(`   Prime targets: ${result.primeTargets}`);
  console.log(`   Jobs queued:   ${result.enrichmentJobsQueued}`);
  console.log(`   Errors:        ${result.errors.length}`);
  console.log(`   Duration:      ${(result.durationMs / 1000).toFixed(1)}s`);
  console.log("═══════════════════════════════════════════\n");

  return result;
}
