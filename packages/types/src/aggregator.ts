// ═══════════════════════════════════════════════
// Aggregator Types — Shared across scrapers
// ═══════════════════════════════════════════════

/**
 * Canonical shape returned by every scraper.
 * Kept intentionally lean — enrichment happens downstream.
 */
export interface RawCompany {
  name: string;
  domain: string;
  sourceUrl: string;
  description: string;
  fundingDate: string; // ISO-8601 date string (YYYY-MM-DD)
}

/**
 * Extended shape produced by the detector after scoring.
 */
export interface ScoredCompany extends RawCompany {
  isPrimeTarget: boolean;
}

/**
 * Result summary returned after a full aggregation run.
 */
export interface AggregationResult {
  scrapedCount: number;
  newCompanies: number;
  primeTargets: number;
  enrichmentJobsQueued: number;
  errors: string[];
  durationMs: number;
}
