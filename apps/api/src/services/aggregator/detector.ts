// ═══════════════════════════════════════════════
// Detector — Dedup, Score, Persist, Enqueue
// ═══════════════════════════════════════════════
//
// Receives the merged RawCompany[] from all three
// scrapers and:
//   1. Filters out companies whose domain already
//      exists in the Company table.
//   2. Scores each remaining company with the
//      "prime target" rule:
//        - fundingDate within 90 days, AND
//        - LinkedIn Jobs API returns 0 job results
//          for that domain → isPrimeTarget = true
//   3. Persists all new companies via Prisma.
//   4. Enqueues an enrichment BullMQ job per company.
// ═══════════════════════════════════════════════

import prisma from "../../lib/prisma.js";
import { enrichmentQueue } from "../../lib/queue.js";
import type { RawCompany, ScoredCompany } from "@internhunter/types";

// ─── LinkedIn Jobs API helper ──────────────────

const LINKEDIN_JOBS_URL = "https://api.linkedin.com/v2/jobSearch";

/**
 * Returns true if the LinkedIn Jobs API reports
 * zero open positions for the given domain.
 *
 * When LINKEDIN_API_KEY is not configured we
 * optimistically assume zero listings (= prime target)
 * so development/testing works without the key.
 */
async function hasZeroLinkedInJobs(domain: string): Promise<boolean> {
  const apiKey = process.env.LINKEDIN_API_KEY;

  if (!apiKey) {
    console.warn(
      "⚪ [detector] LINKEDIN_API_KEY not set — assuming 0 jobs for",
      domain
    );
    return true;
  }

  try {
    const url = new URL(LINKEDIN_JOBS_URL);
    url.searchParams.set("keywords", domain);
    url.searchParams.set("count", "1"); // We only need to know if ≥1 exists

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });

    if (!response.ok) {
      console.warn(
        `⚪ [detector] LinkedIn API ${response.status} for ${domain} — treating as 0 jobs`
      );
      return true;
    }

    const data = (await response.json()) as any;

    // The v2 jobSearch response wraps results in `elements`
    const count =
      data?.paging?.total ??
      data?.elements?.length ??
      0;

    return count === 0;
  } catch (err) {
    console.warn(
      `⚪ [detector] LinkedIn API error for ${domain}:`,
      (err as Error).message,
      "— treating as 0 jobs"
    );
    return true;
  }
}

// ─── Core detection logic ──────────────────────

/**
 * Is the fundingDate within the last 90 days?
 */
function isFundedRecently(fundingDate: string): boolean {
  const funding = new Date(fundingDate);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  return funding >= cutoff;
}

/**
 * Deduplicate the raw array by domain,
 * keeping the first occurrence.
 */
function deduplicateByDomain(companies: RawCompany[]): RawCompany[] {
  const seen = new Set<string>();
  const unique: RawCompany[] = [];

  for (const c of companies) {
    const key = c.domain.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }

  return unique;
}

// ─── Public API ────────────────────────────────

export interface DetectorResult {
  newCompanies: ScoredCompany[];
  persistedCount: number;
  enrichmentJobsQueued: number;
}

/**
 * Full detection pipeline:
 *   merge → dedup → filter existing → score → persist → enqueue
 */
export async function detectAndPersist(
  rawCompanies: RawCompany[]
): Promise<DetectorResult> {
  console.log(
    `🔎 [detector] Received ${rawCompanies.length} raw companies from scrapers`
  );

  // 1. Deduplicate within the scraped batch
  const unique = deduplicateByDomain(rawCompanies);
  console.log(`🔎 [detector] ${unique.length} unique after intra-batch dedup`);

  // 2. Fetch existing domains from DB in one query
  const existingDomains = new Set(
    (
      await prisma.company.findMany({
        where: {
          domain: { in: unique.map((c) => c.domain.toLowerCase()) },
        },
        select: { domain: true },
      })
    ).map((row: any) => row.domain.toLowerCase())
  );

  const novel = unique.filter(
    (c) => !existingDomains.has(c.domain.toLowerCase())
  );
  console.log(
    `🔎 [detector] ${novel.length} new companies (${existingDomains.size} already in DB)`
  );

  if (novel.length === 0) {
    return { newCompanies: [], persistedCount: 0, enrichmentJobsQueued: 0 };
  }

  // 3. Score each company (prime target rule)
  const scored: ScoredCompany[] = [];

  for (const company of novel) {
    let isPrimeTarget = false;

    if (isFundedRecently(company.fundingDate)) {
      const zeroJobs = await hasZeroLinkedInJobs(company.domain);
      isPrimeTarget = zeroJobs;
    }

    scored.push({ ...company, isPrimeTarget });
  }

  const primeCount = scored.filter((c) => c.isPrimeTarget).length;
  console.log(
    `🔎 [detector] Scored: ${primeCount} prime targets out of ${scored.length}`
  );

  // 4. Persist to DB via Prisma (batch upsert to handle races)
  const persisted = await Promise.all(
    scored.map((company) =>
      prisma.company.upsert({
        where: { domain: company.domain.toLowerCase() },
        update: {}, // Already exists — skip
        create: {
          name: company.name,
          domain: company.domain.toLowerCase(),
          fundingStage: company.isPrimeTarget ? "Seed (Prime Target)" : "Seed",
          fundingDate: new Date(company.fundingDate),
          description: company.description,
          techStack: [], // Will be populated during enrichment
          sourceUrl: company.sourceUrl,
        },
      })
    )
  );

  console.log(`🔎 [detector] Persisted ${persisted.length} companies to DB`);

  // 5. Enqueue enrichment job per company
  let jobsQueued = 0;
  for (const dbCompany of persisted) {
    await enrichmentQueue.add(
      "enrich",
      { companyId: dbCompany.id, domain: dbCompany.domain },
      {
        jobId: `enrich-${dbCompany.id}`, // Prevent duplicate jobs
      }
    );
    jobsQueued++;
  }

  console.log(
    `🔎 [detector] Enqueued ${jobsQueued} enrichment jobs in "enrichment" queue`
  );

  return {
    newCompanies: scored,
    persistedCount: persisted.length,
    enrichmentJobsQueued: jobsQueued,
  };
}
