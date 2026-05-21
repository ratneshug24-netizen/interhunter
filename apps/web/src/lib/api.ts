// ═══════════════════════════════════════════════
// API Client — Typed fetch wrapper
// ═══════════════════════════════════════════════

import type { ApiResponse, PaginatedResponse } from "@internhunter/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Companies
  getCompanies: (page = 1, pageSize = 10) =>
    request<PaginatedResponse<any>>(`/api/companies?page=${page}&pageSize=${pageSize}`),

  getCompany: (id: string) =>
    request<ApiResponse<any>>(`/api/companies/${id}`),

  createCompany: (data: any) =>
    request<ApiResponse<any>>("/api/companies", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCompany: (id: string, data: any) =>
    request<ApiResponse<any>>(`/api/companies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteCompany: (id: string) =>
    request<ApiResponse<null>>(`/api/companies/${id}`, { method: "DELETE" }),

  enrichCompany: (id: string) =>
    request<ApiResponse<any>>(`/api/companies/${id}/enrich`, { method: "POST" }),

  // Founders
  getFounders: (companyId?: string) =>
    request<ApiResponse<any[]>>(
      `/api/founders${companyId ? `?companyId=${companyId}` : ""}`
    ),

  createFounder: (data: any) =>
    request<ApiResponse<any>>("/api/founders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Prospects
  getProspects: (page = 1, pageSize = 10, status?: string) =>
    request<PaginatedResponse<any>>(
      `/api/prospects?page=${page}&pageSize=${pageSize}${status ? `&status=${status}` : ""}`
    ),

  getProspect: (id: string) =>
    request<ApiResponse<any>>(`/api/prospects/${id}`),

  updateProspect: (id: string, data: any) =>
    request<ApiResponse<any>>(`/api/prospects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  generateEmail: (id: string) =>
    request<ApiResponse<any>>(`/api/prospects/${id}/generate-email`, {
      method: "POST",
    }),

  sendEmail: (id: string) =>
    request<ApiResponse<any>>(`/api/prospects/${id}/send-email`, {
      method: "POST",
    }),
};
