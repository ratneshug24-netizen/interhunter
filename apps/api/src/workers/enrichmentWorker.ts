// ═══════════════════════════════════════════════
// Enrichment Worker — BuiltWith + Hunter.io +
// Crunchbase Entity API
// ═══════════════════════════════════════════════
//
// Processes jobs from the "enrichment" BullMQ queue.
// Each job payload contains { companyId }.
//
// Three enrichment steps run in parallel via
// Promise.allSettled:
//   1. Tech stack    → BuiltWith Free API
//   2. Founders      → Hunter.io Domain Search
//   3. Funding       → Crunchbase Entity API
//
// After all steps settle, persists results to
// Postgres and enqueues an email-generation job.
//
// Dead-letter: after 3 failed attempts, sets the
// company's enrichmentStatus to FAILED.
// ═══════════════════════════════════════════════

import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis.js";
import { emailGenerateQueue } from "../lib/queue.js";
import prisma from "../lib/prisma.js";
import { config } from "../config.js";
import type { EnrichmentJobData } from "@internhunter/types";

// ─────────────────────────────────────────────
// Types for API responses
// ─────────────────────────────────────────────

interface BuiltWithPath {
  Technologies: Array<{
    Name: string;
    Tag: string;
    Categories?: string[];
  }>;
}

interface BuiltWithResponse {
  Results: Array<{
    Result: {
      Paths: BuiltWithPath[];
    };
  }>;
  Errors?: Array<{ Message: string }>;
}

interface HunterEmail {
  value: string;
  type: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  confidence: number;
}

interface HunterResponse {
  data: {
    domain: string;
    organization: string;
    emails: HunterEmail[];
  };
  errors?: Array<{ id: string; details: string }>;
}

interface CrunchbaseFundingRound {
  money_raised?: { value: number; currency: string; value_usd: number };
  announced_on?: string;
  investment_type?: string;
  investor_identifiers?: Array<{
    value: string;
    permalink: string;
  }>;
}

interface CrunchbaseEntityResponse {
  properties: {
    identifier: { value: string };
    short_description?: string;
    uuid?: string;
  };
  cards?: {
    raised_funding_rounds?: CrunchbaseFundingRound[];
  };
}

// ─────────────────────────────────────────────
// Step 1: BuiltWith — Tech Stack Discovery
// ─────────────────────────────────────────────

interface TechStackResult {
  technologies: string[];
}

async function enrichTechStack(domain: string): Promise<TechStackResult> {
  const apiKey = config.builtwith.apiKey;

  if (!apiKey) {
    console.warn(
      "  ⚙️  [step:techStack] BUILTWITH_API_KEY not set — skipping"
    );
    return { technologies: [] };
  }

  console.log(`  ⚙️  [step:techStack] Querying BuiltWith for ${domain}…`);

  const url = `https://api.builtwith.com/free1/api.json?KEY=${apiKey}&LOOKUP=${domain}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `BuiltWith API returned ${response.status}: ${await response.text()}`
    );
  }

  const data = (await response.json()) as BuiltWithResponse;

  if (data.Errors && data.Errors.length > 0) {
    throw new Error(
      `BuiltWith errors: ${data.Errors.map((e) => e.Message).join("; ")}`
    );
  }

  // Flatten all technology names from all paths
  const techSet = new Set<string>();

  const paths = data.Results?.[0]?.Result?.Paths ?? [];
  for (const path of paths) {
    for (const tech of path.Technologies) {
      if (tech.Name) {
        techSet.add(tech.Name);
      }
    }
  }

  const technologies = Array.from(techSet).sort();

  console.log(
    `  ⚙️  [step:techStack] Found ${technologies.length} technologies`
  );
  return { technologies };
}

// ─────────────────────────────────────────────
// Step 2: Hunter.io — Founders & Emails
// ─────────────────────────────────────────────

interface FounderContact {
  name: string;
  email: string;
  title: string;
}

interface FounderResult {
  contacts: FounderContact[];
}

async function enrichFounders(domain: string): Promise<FounderResult> {
  const apiKey = config.hunter.apiKey;

  if (!apiKey) {
    console.warn(
      "  👤 [step:founders] HUNTER_API_KEY not set — skipping"
    );
    return { contacts: [] };
  }

  console.log(`  👤 [step:founders] Querying Hunter.io for ${domain}…`);

  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(
    domain
  )}&api_key=${apiKey}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `Hunter.io API returned ${response.status}: ${await response.text()}`
    );
  }

  const data = (await response.json()) as HunterResponse;

  if (data.errors && data.errors.length > 0) {
    throw new Error(
      `Hunter.io errors: ${data.errors.map((e) => e.details).join("; ")}`
    );
  }

  // Extract up to 3 contacts with the best confidence
  const sortedEmails = [...data.data.emails]
    .filter((e) => e.value && (e.first_name || e.last_name))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  const contacts: FounderContact[] = sortedEmails.map((email) => ({
    name: [email.first_name, email.last_name].filter(Boolean).join(" "),
    email: email.value,
    title: email.position || "Team Member",
  }));

  console.log(
    `  👤 [step:founders] Found ${contacts.length} contacts`
  );
  return { contacts };
}

// ─────────────────────────────────────────────
// Step 3: Crunchbase Entity — Funding Details
// ─────────────────────────────────────────────

interface FundingResult {
  fundingAmount: string | null;
  investors: string[];
}

async function enrichFunding(
  crunchbaseUuid: string | null
): Promise<FundingResult> {
  if (!crunchbaseUuid) {
    console.log(
      "  💰 [step:funding] No crunchbaseUuid — skipping"
    );
    return { fundingAmount: null, investors: [] };
  }

  const apiKey = config.crunchbase.apiKey;

  if (!apiKey) {
    console.warn(
      "  💰 [step:funding] CRUNCHBASE_API_KEY not set — skipping"
    );
    return { fundingAmount: null, investors: [] };
  }

  console.log(
    `  💰 [step:funding] Querying Crunchbase for UUID ${crunchbaseUuid}…`
  );

  const url = `https://api.crunchbase.com/api/v4/entities/organizations/${crunchbaseUuid}?user_key=${apiKey}&card_ids=raised_funding_rounds`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `Crunchbase Entity API returned ${response.status}: ${await response.text()}`
    );
  }

  const data = (await response.json()) as CrunchbaseEntityResponse;

  const rounds = data.cards?.raised_funding_rounds ?? [];

  // Sum total funding and collect unique investors
  let totalUsd = 0;
  const investorSet = new Set<string>();

  for (const round of rounds) {
    if (round.money_raised?.value_usd) {
      totalUsd += round.money_raised.value_usd;
    }
    for (const inv of round.investor_identifiers ?? []) {
      if (inv.value) {
        investorSet.add(inv.value);
      }
    }
  }

  const fundingAmount =
    totalUsd > 0
      ? `$${(totalUsd / 1_000_000).toFixed(1)}M`
      : null;

  const investors = Array.from(investorSet);

  console.log(
    `  💰 [step:funding] Total: ${fundingAmount ?? "N/A"}, ${investors.length} investors`
  );
  return { fundingAmount, investors };
}

// ─────────────────────────────────────────────
// Enrichment Worker Definition
// ─────────────────────────────────────────────

export const enrichmentWorker = new Worker<EnrichmentJobData>(
  "enrichment",
  async (job: Job<EnrichmentJobData>) => {
    const { companyId } = job.data;

    console.log(
      `\n🔬 [enrichmentWorker] Job ${job.id} — enriching company ${companyId}`
    );

    // ── Fetch company from DB ──────────────────
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error(`Company ${companyId} not found in DB`);
    }

    console.log(
      `🔬 [enrichmentWorker] Company: ${company.name} (${company.domain})`
    );

    // Mark as IN_PROGRESS
    await prisma.company.update({
      where: { id: companyId },
      data: { enrichmentStatus: "IN_PROGRESS" },
    });

    // ── Run all 3 steps in parallel ────────────
    const [techResult, founderResult, fundingResult] =
      await Promise.allSettled([
        enrichTechStack(company.domain),
        enrichFounders(company.domain),
        enrichFunding(company.crunchbaseUuid),
      ]);

    // ── Collect results and errors ─────────────
    const stepErrors: string[] = [];
    let techStack: string[] = company.techStack;
    let contacts: FounderContact[] = [];
    let fundingAmount: string | null = company.fundingAmount ?? null;
    let investors: string[] = company.investors ?? [];

    // Step 1: Tech Stack
    if (techResult.status === "fulfilled") {
      if (techResult.value.technologies.length > 0) {
        techStack = techResult.value.technologies;
      }
    } else {
      const msg = `techStack: ${techResult.reason?.message ?? String(techResult.reason)}`;
      stepErrors.push(msg);
      console.error(`  ❌ [step:techStack] ${msg}`);
    }

    // Step 2: Founders
    if (founderResult.status === "fulfilled") {
      contacts = founderResult.value.contacts;
    } else {
      const msg = `founders: ${founderResult.reason?.message ?? String(founderResult.reason)}`;
      stepErrors.push(msg);
      console.error(`  ❌ [step:founders] ${msg}`);
    }

    // Step 3: Funding
    if (fundingResult.status === "fulfilled") {
      if (fundingResult.value.fundingAmount) {
        fundingAmount = fundingResult.value.fundingAmount;
      }
      if (fundingResult.value.investors.length > 0) {
        investors = fundingResult.value.investors;
      }
    } else {
      const msg = `funding: ${fundingResult.reason?.message ?? String(fundingResult.reason)}`;
      stepErrors.push(msg);
      console.error(`  ❌ [step:funding] ${msg}`);
    }

    // ── Determine enrichment status ────────────
    const allFailed =
      techResult.status === "rejected" &&
      founderResult.status === "rejected" &&
      fundingResult.status === "rejected";

    const anyFailed = stepErrors.length > 0;

    const enrichmentStatus = allFailed
      ? "FAILED"
      : anyFailed
        ? "PARTIAL"
        : "COMPLETED";

    // ── Persist: Update Company row ────────────
    await prisma.company.update({
      where: { id: companyId },
      data: {
        techStack,
        fundingAmount,
        investors,
        enrichmentStatus,
        enrichmentError:
          stepErrors.length > 0 ? stepErrors.join(" | ") : null,
      },
    });

    console.log(
      `🔬 [enrichmentWorker] Company updated — status: ${enrichmentStatus}`
    );

    // ── Persist: Upsert Founder rows ───────────
    if (contacts.length > 0) {
      for (const contact of contacts) {
        await prisma.founder.upsert({
          where: {
            companyId_email: {
              companyId: company.id,
              email: contact.email,
            },
          },
          update: {
            name: contact.name,
            title: contact.title,
          },
          create: {
            companyId: company.id,
            name: contact.name,
            email: contact.email,
            title: contact.title,
          },
        });
      }

      console.log(
        `🔬 [enrichmentWorker] Upserted ${contacts.length} founder(s)`
      );
    }

    // ── Enqueue email-generation job ───────────
    // Only enqueue if enrichment wasn't a total failure
    if (enrichmentStatus !== "FAILED") {
      // First, ensure a Prospect exists for this company
      let prospect = await prisma.prospect.findFirst({
        where: { companyId: company.id },
      });

      if (!prospect) {
        prospect = await prisma.prospect.create({
          data: {
            companyId: company.id,
            status: "PENDING",
          },
        });
      }

      await emailGenerateQueue.add(
        "generate",
        {
          prospectId: prospect.id,
          companyId: company.id,
        },
        {
          jobId: `gen-email-${prospect.id}`, // Prevent duplicates
        }
      );

      console.log(
        `🔬 [enrichmentWorker] Enqueued email-generation for prospect ${prospect.id}`
      );
    }

    console.log(
      `✅ [enrichmentWorker] Job ${job.id} complete — ${enrichmentStatus}\n`
    );

    return {
      companyId,
      enrichmentStatus,
      techStackCount: techStack.length,
      foundersFound: contacts.length,
      fundingAmount,
      investorCount: investors.length,
      stepErrors,
    };
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

// ─────────────────────────────────────────────
// Dead-Letter Handling
// ─────────────────────────────────────────────
// BullMQ fires "failed" on every attempt.
// We check if the job has exhausted all retries
// (attemptsMade >= opts.attempts) to implement
// dead-letter behavior.
// ─────────────────────────────────────────────

enrichmentWorker.on("failed", async (job, err) => {
  if (!job) return;

  const maxAttempts = job.opts?.attempts ?? 3;
  const attemptsUsed = job.attemptsMade;

  console.error(
    `❌ [enrichmentWorker] Job ${job.id} failed ` +
      `(attempt ${attemptsUsed}/${maxAttempts}): ${err.message}`
  );

  // Dead-letter: all retries exhausted
  if (attemptsUsed >= maxAttempts) {
    console.error(
      `💀 [enrichmentWorker] DEAD LETTER — Job ${job.id} exhausted all ${maxAttempts} attempts`
    );

    const companyId = job.data?.companyId;
    if (companyId) {
      try {
        await prisma.company.update({
          where: { id: companyId },
          data: {
            enrichmentStatus: "FAILED",
            enrichmentError: `Dead-lettered after ${maxAttempts} attempts. Last error: ${err.message}`,
          },
        });

        console.error(
          `💀 [enrichmentWorker] Company ${companyId} marked as FAILED`
        );
      } catch (dbErr) {
        console.error(
          `💀 [enrichmentWorker] Failed to update company ${companyId}:`,
          (dbErr as Error).message
        );
      }
    }
  }
});

enrichmentWorker.on("completed", (job) => {
  console.log(
    `✅ [enrichmentWorker] Job ${job.id} completed successfully`
  );
});
