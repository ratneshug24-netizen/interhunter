// ═══════════════════════════════════════════════
// Job Queue Types (BullMQ)
// ═══════════════════════════════════════════════

export enum JobType {
  ENRICH_COMPANY = "enrich-company",
  ENRICHMENT = "enrichment",
  GENERATE_EMAIL = "generate-email",
  SEND_EMAIL = "send-email",
  SCRAPE_STARTUPS = "scrape-startups",
}

export interface EnrichCompanyJobData {
  companyId: string;
  domain: string;
}

export interface EnrichmentJobData {
  companyId: string;
}

export interface GenerateEmailJobData {
  prospectId: string;
  companyId: string;
}

export interface SendEmailJobData {
  prospectId: string;
  recipientEmail: string;
  subject: string;
  body: string;
}

export interface ScrapeStartupsJobData {
  source: string;
  filters?: Record<string, string>;
}

export interface JobStatusResponse {
  jobId: string;
  status: "waiting" | "active" | "completed" | "failed" | "delayed";
  progress: number;
  result?: unknown;
  error?: string;
}
