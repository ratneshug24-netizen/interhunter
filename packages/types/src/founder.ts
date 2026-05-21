// ═══════════════════════════════════════════════
// Founder
// ═══════════════════════════════════════════════

export interface Founder {
  id: string;
  companyId: string;
  name: string;
  email: string;
  title: string;
}

export interface CreateFounderInput {
  companyId: string;
  name: string;
  email: string;
  title: string;
}

export interface UpdateFounderInput extends Partial<Omit<CreateFounderInput, "companyId">> {}
