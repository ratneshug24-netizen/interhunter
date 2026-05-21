// ═══════════════════════════════════════════════
// Product Hunt Scraper — GraphQL API
// ═══════════════════════════════════════════════
//
// Queries the Product Hunt GraphQL API for posts
// from the last 30 days that have a "maker" with
// a website. Requires env var PRODUCTHUNT_API_KEY
// (Developer Token — bearer auth).
// ═══════════════════════════════════════════════

import type { RawCompany } from "@internhunter/types";

const PH_GRAPHQL_URL = "https://api.producthunt.com/v2/api/graphql";

/** The GraphQL query to fetch recent posts with maker info. */
const POSTS_QUERY = `
  query RecentPosts($postedAfter: DateTime!, $first: Int!, $after: String) {
    posts(
      order: NEWEST
      postedAfter: $postedAfter
      first: $first
      after: $after
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          tagline
          url
          website
          createdAt
          makers {
            id
            name
          }
        }
      }
    }
  }
`;

interface PHPostNode {
  id: string;
  name: string;
  tagline: string;
  url: string;
  website: string | null;
  createdAt: string;
  makers: { id: string; name: string }[];
}

interface PHGraphQLResponse {
  data: {
    posts: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: { node: PHPostNode }[];
    };
  };
  errors?: { message: string }[];
}

/**
 * Extract a clean domain from a URL string.
 */
function extractDomain(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Build the ISO timestamp for N days ago.
 */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/**
 * Fetch recent Product Hunt posts via the GraphQL API,
 * filter to those with a website, and return RawCompany[].
 *
 * Paginates through up to 5 pages (50 posts each = 250 max).
 */
export async function scrapeProductHunt(): Promise<RawCompany[]> {
  const apiKey = process.env.PRODUCTHUNT_API_KEY;

  if (!apiKey) {
    console.warn(
      "🟣 [productHuntScraper] PRODUCTHUNT_API_KEY not set — skipping"
    );
    return [];
  }

  console.log("🟣 [productHuntScraper] Querying Product Hunt GraphQL API…");

  const postedAfter = daysAgo(30);
  const allPosts: PHPostNode[] = [];
  let cursor: string | null = null;
  const MAX_PAGES = 5;
  const PAGE_SIZE = 50;

  // ── Paginate through results ─────────────────
  for (let page = 0; page < MAX_PAGES; page++) {
    const variables: Record<string, unknown> = {
      postedAfter,
      first: PAGE_SIZE,
    };
    if (cursor) {
      variables.after = cursor;
    }

    const response = await fetch(PH_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify({ query: POSTS_QUERY, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `🟣 [productHuntScraper] API error ${response.status}: ${errorText}`
      );
      throw new Error(
        `Product Hunt API returned ${response.status}: ${errorText}`
      );
    }

    const json = (await response.json()) as PHGraphQLResponse;

    if (json.errors && json.errors.length > 0) {
      const msgs = json.errors.map((e) => e.message).join("; ");
      console.error(`🟣 [productHuntScraper] GraphQL errors: ${msgs}`);
      throw new Error(`Product Hunt GraphQL errors: ${msgs}`);
    }

    const edges = json.data.posts.edges;
    for (const edge of edges) {
      allPosts.push(edge.node);
    }

    const pageInfo = json.data.posts.pageInfo;
    if (!pageInfo.hasNextPage || !pageInfo.endCursor) break;
    cursor = pageInfo.endCursor;
  }

  console.log(
    `🟣 [productHuntScraper] Fetched ${allPosts.length} posts total`
  );

  // ── Filter to posts with a website (i.e. a company) ──
  const withWebsite = allPosts.filter(
    (post) => post.website && extractDomain(post.website)
  );

  // ── Deduplicate by domain ────────────────────
  const seen = new Set<string>();
  const companies: RawCompany[] = [];

  for (const post of withWebsite) {
    const domain = extractDomain(post.website);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);

    companies.push({
      name: post.name,
      domain,
      sourceUrl: post.url || `https://www.producthunt.com/posts/${post.name.toLowerCase().replace(/\s+/g, "-")}`,
      description: post.tagline || "",
      fundingDate: post.createdAt
        ? post.createdAt.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    });
  }

  console.log(
    `🟣 [productHuntScraper] Parsed ${companies.length} unique companies with websites`
  );
  return companies;
}
