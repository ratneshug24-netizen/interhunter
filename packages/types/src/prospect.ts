// ═══════════════════════════════════════════════
// Prospect
// ═══════════════════════════════════════════════

export enum ProspectStatus {
  PENDING = "PENDING",
  REVIEWED = "REVIEWED",
  SENT = "SENT",
  SKIPPED = "SKIPPED",
}

export interface Prospect {
  id: string;
  companyId: string;
  status: ProspectStatus;
  generatedEmail: string | null;
  editedEmail: string | null;
  createdAt: Date | string;
}

export interface CreateProspectInput {
  companyId: string;
  status?: ProspectStatus;
  generatedEmail?: string;
  editedEmail?: string;
}

export interface UpdateProspectInput {
  status?: ProspectStatus;
  generatedEmail?: string;
  editedEmail?: string;
}
