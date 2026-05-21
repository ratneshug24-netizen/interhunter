// ═══════════════════════════════════════════════
// YC Scraper — Work at a Startup (Puppeteer)
// ═══════════════════════════════════════════════
//
// Scrapes https://www.workatastartup.com/companies
// using headless Puppeteer. The page renders company
// cards client-side, so we need a real browser.
// ═══════════════════════════════════════════════

import puppeteer from "puppeteer";
import type { RawCompany } from "@internhunter/types";

const TARGET_URL = "https://www.workatastartup.com/companies";
const SCROLL_PAUSE_MS = 1500;
const MAX_SCROLLS = 15;

/**
 * Launch headless Chromium, scroll the infinite-scroll page
 * to load companies, then extract structured data from each
 * company card in the DOM.
 */
export async function scrapeYCStartups(): Promise<RawCompany[]> {
  console.log("🟠 [ycScraper] Launching Puppeteer…");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();

    // Avoid loading images/fonts to speed up scrape
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
      if (["image", "font", "media"].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    console.log("🟠 [ycScraper] Navigating to", TARGET_URL);
    await page.goto(TARGET_URL, {
      waitUntil: "networkidle2",
      timeout: 60_000,
    });

    // ── Scroll to load more companies ──────────
    let previousHeight = 0;
    for (let i = 0; i < MAX_SCROLLS; i++) {
      const currentHeight = await page.evaluate(
        () => document.body.scrollHeight
      );
      if (currentHeight === previousHeight) break;
      previousHeight = currentHeight;

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise((r) => setTimeout(r, SCROLL_PAUSE_MS));
    }

    // ── Extract company cards ──────────────────
    const companies = await page.evaluate(() => {
      const cards = document.querySelectorAll(
        // WAAS uses different card selectors depending on redesigns;
        // we try the most common patterns and fall back gracefully.
        '[class*="company-card"], [class*="CompanyCard"], [data-company]'
      );

      const results: {
        name: string;
        domain: string;
        sourceUrl: string;
        description: string;
      }[] = [];

      cards.forEach((card: Element) => {
        const nameEl =
          card.querySelector("h2") ||
          card.querySelector('[class*="name"]') ||
          card.querySelector("a > span");

        const descEl =
          card.querySelector('[class*="description"]') ||
          card.querySelector("p");

        const linkEl = card.querySelector("a[href]") as HTMLAnchorElement | null;

        const name = nameEl?.textContent?.trim() || "";
        const description = descEl?.textContent?.trim() || "";
        const href = linkEl?.href || "";

        if (!name) return;

        // Derive domain from the card link or company name
        let domain = "";
        try {
          if (href && !href.includes("workatastartup.com")) {
            domain = new URL(href).hostname.replace(/^www\./, "");
          }
        } catch {
          // href wasn't a valid URL; skip
        }

        if (!domain) {
          // Fallback: slugify the name
          domain =
            name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "")
              .slice(0, 30) + ".com";
        }

        const sourceUrl = href.startsWith("http")
          ? href
          : `https://www.workatastartup.com${href}`;

        results.push({ name, domain, sourceUrl, description });
      });

      return results;
    });

    // Attach a synthetic fundingDate (today, since WAAS
    // doesn't expose the actual funding date)
    const today = new Date().toISOString().slice(0, 10);
    const raw: RawCompany[] = companies.map((c) => ({
      ...c,
      fundingDate: today,
    }));

    console.log(`🟠 [ycScraper] Scraped ${raw.length} companies`);
    return raw;
  } finally {
    await browser.close();
  }
}
