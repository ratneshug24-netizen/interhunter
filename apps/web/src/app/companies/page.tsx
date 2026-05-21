"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Company {
  id: string;
  name: string;
  domain: string;
  fundingStage: string;
  fundingDate: string;
  description: string;
  techStack: string[];
  sourceUrl: string;
  founders: { id: string; name: string; email: string; title: string }[];
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    try {
      setLoading(true);
      const res = await api.getCompanies(1, 50);
      setCompanies(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrich(companyId: string) {
    try {
      await api.enrichCompany(companyId);
      alert("Enrichment job queued!");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="section-header">
          <div>
            <h1 className="section-title">Companies</h1>
            <p className="section-subtitle">Loading company data…</p>
          </div>
        </div>
        <div className="card-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-text" />
              <div className="skeleton skeleton-text" style={{ width: "60%" }} />
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
        <button className="btn btn-primary" onClick={loadCompanies} style={{ marginTop: "var(--space-lg)" }}>
          Retry
        </button>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">🏢</div>
        <h3>No Companies Yet</h3>
        <p>Companies will appear here once you start scraping or adding them via the API.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">Companies</h1>
          <p className="section-subtitle">
            {companies.length} startup{companies.length !== 1 ? "s" : ""} discovered
          </p>
        </div>
      </div>

      <div className="card-grid stagger">
        {companies.map((company) => (
          <div key={company.id} className="card animate-slide-up">
            <div className="card-header">
              <div>
                <div className="card-title">{company.name}</div>
                <div className="card-subtitle">{company.domain}</div>
              </div>
              <span className={`badge badge-${company.fundingStage.toLowerCase().replace(/[- ]/g, "")}`}>
                {company.fundingStage}
              </span>
            </div>

            <div className="card-body">
              <p>{company.description}</p>

              <div className="tags-row">
                {company.techStack.map((tech) => (
                  <span key={tech} className="tag">
                    {tech}
                  </span>
                ))}
              </div>

              {company.founders.length > 0 && (
                <div style={{ marginTop: "var(--space-md)", fontSize: "0.8125rem" }}>
                  <strong style={{ color: "var(--text-primary)" }}>Founders: </strong>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {company.founders.map((f) => `${f.name} (${f.title})`).join(", ")}
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-lg)" }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleEnrich(company.id)}
              >
                📊 Enrich
              </button>
              <a
                href={company.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
              >
                🔗 Source
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
