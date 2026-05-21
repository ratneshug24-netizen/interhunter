// ═══════════════════════════════════════════════
// Crunchbase Scraper — Basic API (REST)
// ═══════════════════════════════════════════════
//
// Queries the Crunchbase Basic API for companies
// with funding_type = "seed" funded in the last
// 90 days. Requires env var CRUNCHBASE_API_KEY.
// ═══════════════════════════════════════════════

import type { RawCompany } from "@internhunter/types";

const CB_BASE_URL = "https://api.crunchbase.com/api/v4";

interface CrunchbaseOrg {
  properties: {
    identifier: { value: string; permalink: string };
    short_description?: string;
    website_url?: string;
    founded_on?: string;
    last_funding_at?: string;
  };
}

interface CrunchbaseSearchResponse {
  count: number;
  entities: CrunchbaseOrg[];
}

/**
 * Build the date string for 90 days ago in YYYY-MM-DD format.
 */
function ninetyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

/**
 * Extract a clean domain from a URL string.
 */
function extractDomain(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Query Crunchbase Basic API for seed-stage companies
 * funded in the last 90 days and map results to RawCompany[].
 */
export async function scrapeCrunchbase(): Promise<RawCompany[]> {
  const apiKey = process.env.CRUNCHBASE_API_KEY;

  if (!apiKey) {
    console.warn(
      "🔵 [crunchbaseScraper] CRUNCHBASE_API_KEY not set — skipping"
    );
    return [];
  }

  console.log("🔵 [crunchbaseScraper] Querying Crunchbase API…");

  const sinceDate = ninetyDaysAgo();

  // ── Build the search request body ────────────
  const searchBody = {
    field_ids: [
      "identifier",
      "short_description",
      "website_url",
      "founded_on",
      "last_funding_at",
    ],
    query: [
      {
        type: "predicate",
        field_id: "funding_type",
        operator_id: "includes",
        values: ["seed"],
      },
      {
        type: "predicate",
        field_id: "last_funding_at",
        operator_id: "gte",
        values: [sinceDate],
      },
    ],
    order: [
      {
        field_id: "last_funding_at",
        sort: "desc" as const,
      },
    ],
    limit: 100,
  };

  const url = `${CB_BASE_URL}/searches/organizations?user_key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(searchBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `🔵 [crunchbaseScraper] API error ${response.status}: ${errorText}`
    );
    throw new Error(
      `Crunchbase API returned ${response.status}: ${errorText}`
    );
  }

  const data = (await response.json()) as CrunchbaseSearchResponse;

  console.log(
    `🔵 [crunchbaseScraper] Received ${data.count} results from Crunchbase`
  );

  // ── Map to RawCompany ────────────────────────
  const companies: RawCompany[] = data.entities
    .map((entity) => {
      const props = entity.properties;
      const name = props.identifier?.value || "";
      const permalink = props.identifier?.permalink || "";
      const domain = extractDomain(props.website_url);
      const description = props.short_description || "";
      const fundingDate =
        props.last_funding_at || new Date().toISOString().slice(0, 10);
      const sourceUrl = `https://www.crunchbase.com/organization/${permalink}`;

      return { name, domain, sourceUrl, description, fundingDate };
    })
    .filter((c) => c.name && c.domain); // Drop entries without name or domain

  console.log(
    `🔵 [crunchbaseScraper] Parsed ${companies.length} valid companies`
  );
  return companies;
}
