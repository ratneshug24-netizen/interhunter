"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Prospect {
  id: string;
  companyId: string;
  status: "PENDING" | "REVIEWED" | "SENT" | "SKIPPED";
  generatedEmail: string | null;
  editedEmail: string | null;
  createdAt: string;
  company: {
    id: string;
    name: string;
    domain: string;
    fundingStage: string;
    techStack: string[];
    founders: { name: string; email: string; title: string }[];
  };
}

const STATUS_FILTERS = ["ALL", "PENDING", "REVIEWED", "SENT", "SKIPPED"] as const;

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadProspects();
  }, [filter]);

  async function loadProspects() {
    try {
      setLoading(true);
      const status = filter === "ALL" ? undefined : filter;
      const res = await api.getProspects(1, 50, status);
      setProspects(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateEmail(prospectId: string) {
    try {
      await api.generateEmail(prospectId);
      alert("Email generation queued! Refresh in a few seconds.");
      setTimeout(loadProspects, 3000);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  }

  async function handleSendEmail(prospectId: string) {
    if (!confirm("Send this email?")) return;
    try {
      await api.sendEmail(prospectId);
      alert("Email send queued!");
      setTimeout(loadProspects, 2000);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  }

  async function handleSkip(prospectId: string) {
    try {
      await api.updateProspect(prospectId, { status: "SKIPPED" });
      loadProspects();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="section-header">
          <div>
            <h1 className="section-title">Prospects</h1>
            <p className="section-subtitle">Loading prospects…</p>
          </div>
        </div>
        <div className="card-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-text" />
              <div className="skeleton skeleton-text" style={{ width: "50%" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="icon">⚠️</div>
        <h3>Failed to Load</h3>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={loadProspects} style={{ marginTop: "var(--space-lg)" }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">Prospects</h1>
          <p className="section-subtitle">
            {prospects.length} prospect{prospects.length !== 1 ? "s" : ""} in pipeline
          </p>
        </div>
      </div>

      {/* ── Status Filter Tabs ──────────────── */}
      <div style={{ display: "flex", gap: "var(--space-xs)", marginBottom: "var(--space-xl)", flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            className={`btn btn-sm ${filter === status ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter(status)}
          >
            {status}
          </button>
        ))}
      </div>

      {prospects.length === 0 ? (
        <div className="empty-state">
          <div className="icon">✉️</div>
          <h3>No Prospects</h3>
          <p>
            {filter === "ALL"
              ? "Prospects will appear once companies are added."
              : `No prospects with status "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="card-grid stagger">
          {prospects.map((prospect) => (
            <div key={prospect.id} className="card animate-slide-up">
              <div className="card-header">
                <div>
                  <div className="card-title">{prospect.company.name}</div>
                  <div className="card-subtitle">
                    {prospect.company.domain} · {prospect.company.fundingStage}
                  </div>
                </div>
                <span className={`badge badge-${prospect.status.toLowerCase()}`}>
                  {prospect.status}
                </span>
              </div>

              <div className="card-body">
                {prospect.company.founders.length > 0 && (
                  <p style={{ marginBottom: "var(--space-sm)" }}>
                    <strong>To: </strong>
                    {prospect.company.founders[0].name} ({prospect.company.founders[0].email})
                  </p>
                )}

                <div className="tags-row">
                  {prospect.company.techStack.map((tech) => (
                    <span key={tech} className="tag">
                      {tech}
                    </span>
                  ))}
                </div>

                {/* Expandable Email Preview */}
                {(prospect.generatedEmail || prospect.editedEmail) && (
                  <div style={{ marginTop: "var(--space-md)" }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setExpandedId(expandedId === prospect.id ? null : prospect.id)
                      }
                    >
                      {expandedId === prospect.id ? "▾ Hide" : "▸ Show"} Email Preview
                    </button>
                    {expandedId === prospect.id && (
                      <div className="email-preview" style={{ marginTop: "var(--space-sm)" }}>
                        {prospect.editedEmail || prospect.generatedEmail}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Action Buttons ──────────── */}
              <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-lg)", flexWrap: "wrap" }}>
                {prospect.status === "PENDING" && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleGenerateEmail(prospect.id)}
                  >
                    ✨ Generate Email
                  </button>
                )}

                {prospect.status === "REVIEWED" && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSendEmail(prospect.id)}
                  >
                    🚀 Send Email
                  </button>
                )}

                {(prospect.status === "PENDING" || prospect.status === "REVIEWED") && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleSkip(prospect.id)}
                  >
                    Skip
                  </button>
                )}

                {prospect.status === "SENT" && (
                  <span style={{ fontSize: "0.8125rem", color: "var(--accent-success)", fontWeight: 600 }}>
                    ✓ Email Delivered
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
