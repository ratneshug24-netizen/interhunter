import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InternHunter — Smart Startup Outreach",
  description:
    "Find early-stage startups, enrich their data, and send personalized cold emails to land your dream internship.",
  keywords: ["internship", "startups", "cold outreach", "email generator"],
};

import Providers from "./Providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {/* ── Navbar ──────────────────────────── */}
          <nav className="navbar">
            <div className="navbar-brand">
              <span className="icon">🎯</span>
              InternHunter
            </div>
            <ul className="navbar-links">
              <li>
                <a href="/" className="active">
                  Dashboard
                </a>
              </li>
              <li>
                <a href="/companies">Companies</a>
              </li>
              <li>
                <a href="/prospects">Prospects</a>
              </li>
            </ul>
          </nav>

          {/* ── Main Content ────────────────────── */}
          <main className="app-container">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
