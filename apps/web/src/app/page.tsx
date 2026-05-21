export default function Home() {
  return (
    <>
      {/* ── Hero Section ─────────────────────── */}
      <section className="hero">
        <h1>
          Land Your Dream Internship
          <br />
          at <span className="gradient-text">Early-Stage Startups</span>
        </h1>
        <p>
          InternHunter discovers freshly funded startups, enriches company data,
          and generates personalized cold emails — so you can focus on what
          matters: making a great impression.
        </p>
        <div style={{ display: "flex", gap: "var(--space-md)", justifyContent: "center" }}>
          <a href="/companies" className="btn btn-primary">
            🏢 Browse Companies
          </a>
          <a href="/prospects" className="btn btn-secondary">
            ✉️ View Prospects
          </a>
        </div>
      </section>

      {/* ── Stats ────────────────────────────── */}
      <div className="stats-row stagger">
        <div className="stat-card animate-slide-up">
          <div className="stat-value">0</div>
          <div className="stat-label">Companies Found</div>
        </div>
        <div className="stat-card animate-slide-up">
          <div className="stat-value">0</div>
          <div className="stat-label">Emails Generated</div>
        </div>
        <div className="stat-card animate-slide-up">
          <div className="stat-value">0</div>
          <div className="stat-label">Emails Sent</div>
        </div>
        <div className="stat-card animate-slide-up">
          <div className="stat-value">0%</div>
          <div className="stat-label">Response Rate</div>
        </div>
      </div>

      {/* ── How It Works ─────────────────────── */}
      <div className="section-header">
        <div>
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">
            Four steps from discovery to inbox
          </p>
        </div>
      </div>

      <div className="card-grid stagger">
        <div className="card animate-slide-up">
          <div className="card-header">
            <div>
              <div className="card-title">🔍 Discover</div>
              <div className="card-subtitle">Step 1</div>
            </div>
          </div>
          <div className="card-body">
            Scrape funding announcements from Crunchbase, AngelList, and
            Product Hunt to find freshly funded Pre-Seed and Seed stage
            startups building with tech you know.
          </div>
        </div>

        <div className="card animate-slide-up">
          <div className="card-header">
            <div>
              <div className="card-title">📊 Enrich</div>
              <div className="card-subtitle">Step 2</div>
            </div>
          </div>
          <div className="card-body">
            Automatically pull founder names, emails, tech stacks,
            and company descriptions to build rich prospect profiles
            with zero manual research.
          </div>
        </div>

        <div className="card animate-slide-up">
          <div className="card-header">
            <div>
              <div className="card-title">✨ Generate</div>
              <div className="card-subtitle">Step 3</div>
            </div>
          </div>
          <div className="card-body">
            Use LLM-powered email generation to craft personalized,
            context-aware cold emails that mention the startup&apos;s
            specific tech stack and mission.
          </div>
        </div>

        <div className="card animate-slide-up">
          <div className="card-header">
            <div>
              <div className="card-title">🚀 Send</div>
              <div className="card-subtitle">Step 4</div>
            </div>
          </div>
          <div className="card-body">
            Review generated emails, make edits, then send directly
            from the dashboard. Track status from PENDING through
            REVIEWED to SENT.
          </div>
        </div>
      </div>
    </>
  );
}
