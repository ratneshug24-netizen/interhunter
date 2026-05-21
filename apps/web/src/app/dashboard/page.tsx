import ProspectDashboardClient from "./ProspectDashboardClient";

// A simple helper to get the API URL
const getApiUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
};

async function getStats() {
  try {
    const res = await fetch(`${getApiUrl()}/prospects/stats`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch (e) {
    console.error("Failed to fetch stats", e);
    return null;
  }
}

async function getProspects() {
  try {
    const res = await fetch(`${getApiUrl()}/prospects?status=PENDING&page=1&pageSize=20`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json;
  } catch (e) {
    console.error("Failed to fetch prospects", e);
    return null;
  }
}

export default async function DashboardPage() {
  const [stats, prospectsRes] = await Promise.all([getStats(), getProspects()]);

  return (
    <div className="w-full h-[calc(100vh-80px)] overflow-hidden">
      <ProspectDashboardClient initialStats={stats} initialProspects={prospectsRes} />
    </div>
  );
}
