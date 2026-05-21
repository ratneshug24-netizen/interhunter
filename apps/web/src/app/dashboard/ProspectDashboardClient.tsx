"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ProspectDetailPanel from "./ProspectDetailPanel";
import { formatDistanceToNow } from "date-fns";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export default function ProspectDashboardClient({
  initialStats,
  initialProspects,
}: {
  initialStats: any;
  initialProspects: any;
}) {
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["prospects", "stats"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/prospects/stats`);
      const json = await res.json();
      return json.data;
    },
    initialData: initialStats,
    refetchInterval: 5000,
  });

  const { data: prospectsData, refetch: refetchProspects } = useQuery({
    queryKey: ["prospects", "feed"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/prospects?status=PENDING&page=1&pageSize=20`);
      const json = await res.json();
      return json;
    },
    initialData: initialProspects,
  });

  const prospects = prospectsData?.data || [];

  const selectedProspect = prospects.find((p: any) => p.id === selectedProspectId);

  return (
    <div className="flex h-full w-full bg-[#0a0a0f] text-white">
      {/* ── Left Sidebar (Stats) ── */}
      <div className="w-64 border-r border-[rgba(255,255,255,0.1)] p-6 flex flex-col gap-6 overflow-y-auto">
        <div>
          <h2 className="text-xl font-bold mb-4 tracking-tight">Overview</h2>
          <div className="space-y-4">
            <div className="bg-[#16161f] border border-[rgba(255,255,255,0.1)] rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Total Prospects</div>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </div>
            <div className="bg-[#16161f] border border-[rgba(255,255,255,0.1)] rounded-lg p-4 border-l-4 border-l-yellow-500">
              <div className="text-sm text-gray-400 mb-1">Pending Review</div>
              <div className="text-2xl font-bold">{stats?.pending || 0}</div>
            </div>
            <div className="bg-[#16161f] border border-[rgba(255,255,255,0.1)] rounded-lg p-4 border-l-4 border-l-green-500">
              <div className="text-sm text-gray-400 mb-1">Emails Sent</div>
              <div className="text-2xl font-bold">{stats?.sent || 0}</div>
            </div>
            <div className="bg-[#16161f] border border-[rgba(255,255,255,0.1)] rounded-lg p-4 border-l-4 border-l-gray-500">
              <div className="text-sm text-gray-400 mb-1">Skipped</div>
              <div className="text-2xl font-bold">{stats?.skipped || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Feed ── */}
      <div className={`flex-1 overflow-y-auto p-6 ${selectedProspectId ? "hidden lg:block lg:w-1/3" : "w-full"}`}>
        <h2 className="text-2xl font-bold mb-6">Pending Prospects</h2>
        {prospects.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">No pending prospects found.</div>
        ) : (
          <div className="grid gap-4">
            {prospects.map((p: any) => {
              const founder = p.company?.founders?.[0];
              const isSelected = selectedProspectId === p.id;
              
              let previewBody = "";
              let previewSubject = "";
              if (p.parsedEmail) {
                previewSubject = p.parsedEmail.subject;
                previewBody = p.parsedEmail.body?.substring(0, 100) + "...";
              }

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProspectId(p.id)}
                  className={`bg-[#16161f] border rounded-lg p-5 cursor-pointer transition-all ${
                    isSelected ? "border-[#6c5ce7] shadow-[0_0_15px_rgba(108,92,231,0.2)]" : "border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)]"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{p.company?.name}</h3>
                    <span className="text-xs text-gray-400">
                      {p.company?.fundingDate ? formatDistanceToNow(new Date(p.company.fundingDate), { addSuffix: true }) : ""}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-400 mb-3">
                    {p.company?.fundingStage} • {p.company?.fundingAmount || "Undisclosed"} • {p.company?.domain}
                  </div>

                  {p.company?.techStack && p.company.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {p.company.techStack.slice(0, 5).map((tech: string) => (
                        <span key={tech} className="bg-[rgba(108,92,231,0.1)] text-[#6c5ce7] text-xs px-2 py-0.5 rounded border border-[rgba(108,92,231,0.2)]">
                          {tech}
                        </span>
                      ))}
                      {p.company.techStack.length > 5 && (
                        <span className="text-xs text-gray-500 px-1 py-0.5">+{p.company.techStack.length - 5}</span>
                      )}
                    </div>
                  )}

                  <div className="mb-3 text-sm">
                    <span className="text-gray-300">👤 {founder?.name || "Unknown"}</span>
                    <span className="text-gray-500 ml-2">{founder?.title}</span>
                  </div>

                  {p.parsedEmail ? (
                    <div className="bg-[#12121a] rounded p-3 text-sm border border-[rgba(255,255,255,0.05)]">
                      <div className="font-semibold text-gray-300 mb-1 line-clamp-1">{previewSubject}</div>
                      <div className="text-gray-500 line-clamp-2">{previewBody}</div>
                    </div>
                  ) : (
                    <div className="bg-yellow-900/20 text-yellow-500 rounded p-3 text-sm border border-yellow-700/30">
                      Email generating...
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right Panel (Details & Actions) ── */}
      {selectedProspectId && (
        <div className="w-full lg:w-[45%] lg:min-w-[500px] border-l border-[rgba(255,255,255,0.1)] bg-[#12121a] flex flex-col h-full overflow-hidden">
          {selectedProspect ? (
            <ProspectDetailPanel
              prospect={selectedProspect}
              onClose={() => setSelectedProspectId(null)}
              onRefresh={() => refetchProspects()}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">Loading...</div>
          )}
        </div>
      )}
    </div>
  );
}
