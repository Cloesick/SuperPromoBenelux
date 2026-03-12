import type { Metadata } from "next";
import Link from "next/link";
import { getDailyMetrics, getRetailerMetrics } from "@/lib/eventsDb";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Engagement",
  robots: { index: false, follow: false },
};

type EngagementRow = {
  retailer: string;
  folder_view: number;
  folder_engaged_15s: number;
  folder_scroll_50: number;
  folder_scroll_90: number;
  folder_page_turn: number;
};

function safeDaysFromSearchParams(sp: Record<string, string | string[] | undefined>, fallback: number) {
  const daysRaw = sp.days;
  const days = Array.isArray(daysRaw) ? Number(daysRaw[0]) : Number(daysRaw ?? fallback);
  return Number.isFinite(days) ? Math.min(Math.max(Math.floor(days), 1), 365) : fallback;
}

export default async function AdminEngagementPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const safeDays = safeDaysFromSearchParams(sp, 30);

  const [views, engaged15, scroll50, scroll90, pageTurns, dailyAll] = await Promise.all([
    getRetailerMetrics({ eventName: "folder_view", limit: 2000, days: safeDays }),
    getRetailerMetrics({ eventName: "folder_engaged_15s", limit: 2000, days: safeDays }),
    getRetailerMetrics({ eventName: "folder_scroll_50", limit: 2000, days: safeDays }),
    getRetailerMetrics({ eventName: "folder_scroll_90", limit: 2000, days: safeDays }),
    getRetailerMetrics({ eventName: "folder_page_turn", limit: 2000, days: safeDays }),
    getDailyMetrics({ days: safeDays }),
  ]);

  const map = new Map<string, EngagementRow>();
  const upsert = (retailer: string, patch: Partial<EngagementRow>) => {
    const existing = map.get(retailer);
    map.set(retailer, {
      retailer,
      folder_view: existing?.folder_view ?? 0,
      folder_engaged_15s: existing?.folder_engaged_15s ?? 0,
      folder_scroll_50: existing?.folder_scroll_50 ?? 0,
      folder_scroll_90: existing?.folder_scroll_90 ?? 0,
      folder_page_turn: existing?.folder_page_turn ?? 0,
      ...patch,
    });
  };

  for (const r of views) {
    const k = r.retailer ?? "";
    if (!k) continue;
    upsert(k, { folder_view: r.count ?? 0 });
  }
  for (const r of engaged15) {
    const k = r.retailer ?? "";
    if (!k) continue;
    upsert(k, { folder_engaged_15s: r.count ?? 0 });
  }
  for (const r of scroll50) {
    const k = r.retailer ?? "";
    if (!k) continue;
    upsert(k, { folder_scroll_50: r.count ?? 0 });
  }
  for (const r of scroll90) {
    const k = r.retailer ?? "";
    if (!k) continue;
    upsert(k, { folder_scroll_90: r.count ?? 0 });
  }
  for (const r of pageTurns) {
    const k = r.retailer ?? "";
    if (!k) continue;
    upsert(k, { folder_page_turn: r.count ?? 0 });
  }

  const rows = Array.from(map.values()).sort((a, b) => b.folder_view - a.folder_view);

  const engagementEvents = new Set([
    "folder_view",
    "folder_engaged_15s",
    "folder_scroll_50",
    "folder_scroll_90",
    "folder_page_turn",
  ]);

  const daily = dailyAll.filter((d) => engagementEvents.has(d.event_name));

  const fmtPct = (num: number, den: number) => {
    if (!den) return "";
    const v = (num / den) * 100;
    return `${v.toFixed(1)}%`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Engagement</h1>
        <Link href="/admin" className="text-sm text-blue-700 hover:text-blue-900">
          Admin
        </Link>
      </div>

      <p className="text-sm text-gray-600 mt-2">Laatste {safeDays} dagen. Consent-gated events.</p>

      <div className="mt-3 flex items-center gap-3 text-sm">
        <Link href="/admin/engagement?days=7" className="text-blue-700 hover:text-blue-900">
          7d
        </Link>
        <Link href="/admin/engagement?days=30" className="text-blue-700 hover:text-blue-900">
          30d
        </Link>
        <Link href="/admin/engagement?days=60" className="text-blue-700 hover:text-blue-900">
          60d
        </Link>
        <Link href="/admin/engagement?days=365" className="text-blue-700 hover:text-blue-900">
          365d
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left font-medium px-3 py-2">Retailer</th>
              <th className="text-right font-medium px-3 py-2">Views</th>
              <th className="text-right font-medium px-3 py-2">Engaged 15s</th>
              <th className="text-right font-medium px-3 py-2">Engaged %</th>
              <th className="text-right font-medium px-3 py-2">Scroll 50</th>
              <th className="text-right font-medium px-3 py-2">Scroll 90</th>
              <th className="text-right font-medium px-3 py-2">Scroll 90 %</th>
              <th className="text-right font-medium px-3 py-2">Page turns</th>
              <th className="text-right font-medium px-3 py-2">Turns / view</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-gray-600" colSpan={9}>
                  Geen data.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.retailer}>
                  <td className="px-3 py-2 text-gray-900 font-medium whitespace-nowrap">{r.retailer}</td>
                  <td className="px-3 py-2 text-gray-800 text-right whitespace-nowrap">{r.folder_view}</td>
                  <td className="px-3 py-2 text-gray-800 text-right whitespace-nowrap">{r.folder_engaged_15s}</td>
                  <td className="px-3 py-2 text-gray-800 text-right whitespace-nowrap">
                    {fmtPct(r.folder_engaged_15s, r.folder_view)}
                  </td>
                  <td className="px-3 py-2 text-gray-800 text-right whitespace-nowrap">{r.folder_scroll_50}</td>
                  <td className="px-3 py-2 text-gray-800 text-right whitespace-nowrap">{r.folder_scroll_90}</td>
                  <td className="px-3 py-2 text-gray-800 text-right whitespace-nowrap">
                    {fmtPct(r.folder_scroll_90, r.folder_view)}
                  </td>
                  <td className="px-3 py-2 text-gray-800 text-right whitespace-nowrap">{r.folder_page_turn}</td>
                  <td className="px-3 py-2 text-gray-800 text-right whitespace-nowrap">
                    {r.folder_view ? (r.folder_page_turn / r.folder_view).toFixed(2) : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Timeseries</h2>
        <p className="text-sm text-gray-600 mt-1">Engagement events per dag (laatste {safeDays} dagen).</p>

        <div className="mt-3 overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left font-medium px-3 py-2">Dag</th>
                <th className="text-left font-medium px-3 py-2">Event</th>
                <th className="text-right font-medium px-3 py-2">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {daily.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-gray-600" colSpan={3}>
                    Geen data.
                  </td>
                </tr>
              ) : (
                daily.map((m, idx) => (
                  <tr key={`${m.day}-${m.event_name}-${idx}`}>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900 font-medium">{m.day}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-800">{m.event_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-gray-800">{m.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
