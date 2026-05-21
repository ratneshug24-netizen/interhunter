// ═══════════════════════════════════════════════
// Company
// ═══════════════════════════════════════════════

export enum EnrichmentStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  PARTIAL = "PARTIAL",
  FAILED = "FAILED",
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  fundingStage: string;
  fundingDate: Date | string;
  description: string;
  techStack: string[];
  sourceUrl: string;
  createdAt: Date | string;
  enrichmentStatus: EnrichmentStatus;
  enrichmentError: string | null;
  fundingAmount: string | null;
  investors: string[];
  crunchbaseUuid: string | null;
}

export interface CreateCompanyInput {
  name: string;
  domain: string;
  fundingStage: string;
  fundingDate: string;
  description: string;
  techStack: string[];
  sourceUrl: string;
}

export interface UpdateCompanyInput extends Partial<CreateCompanyInput> {}
