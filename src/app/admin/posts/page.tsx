import type { Metadata } from "next";
import Link from "next/link";
import { getUtmContentMetrics, getUtmOnlyMetrics } from "@/lib/eventsDb";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Posts",
  robots: { index: false, follow: false },
};

type Row = {
  utm_content: string;
  attribution_set_total: number;
  outbound_click_total: number;
};

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const daysRaw = sp.days;
  const days = Array.isArray(daysRaw) ? Number(daysRaw[0]) : Number(daysRaw ?? 30);
  const safeDays = Number.isFinite(days) ? Math.min(Math.max(Math.floor(days), 1), 365) : 30;

  const [attrib, clicks] = await Promise.all([
    getUtmOnlyMetrics({ eventName: "attribution_set", limit: 5000, days: safeDays }),
    getUtmContentMetrics({ eventName: "outbound_click", limit: 5000, days: safeDays }),
  ]);

  const map = new Map<string, Row>();

  for (const a of attrib) {
    const utm = a.utm_content ?? "";
    if (!utm) continue;
    map.set(utm, {
      utm_content: utm,
      attribution_set_total: a.count ?? 0,
      outbound_click_total: 0,
    });
  }

  for (const c of clicks) {
    const utm = c.utm_content ?? "";
    if (!utm) continue;
    const existing = map.get(utm);
    map.set(utm, {
      utm_content: utm,
      attribution_set_total: existing?.attribution_set_total ?? 0,
      outbound_click_total: (existing?.outbound_click_total ?? 0) + (c.count ?? 0),
    });
  }

  const rows = Array.from(map.values())
    .filter((r) => r.utm_content.length > 0)
    .sort((a, b) => b.outbound_click_total - a.outbound_click_total);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Posts (utm_content)</h1>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-blue-700 hover:text-blue-900">
            Admin
          </Link>
          <a
            href={`/admin/export/events?event=outbound_click&days=${safeDays}&limit=50000`}
            className="text-sm text-blue-700 hover:text-blue-900"
          >
            Export outbound_click (CSV)
          </a>
        </div>
      </div>

      <p className="text-sm text-gray-600 mt-2">Laatste {safeDays} dagen.</p>

      <div className="mt-3 flex items-center gap-3 text-sm">
        <Link href="/admin/posts?days=7" className="text-blue-700 hover:text-blue-900">
          7d
        </Link>
        <Link href="/admin/posts?days=30" className="text-blue-700 hover:text-blue-900">
          30d
        </Link>
        <Link href="/admin/posts?days=60" className="text-blue-700 hover:text-blue-900">
          60d
        </Link>
        <Link href="/admin/posts?days=365" className="text-blue-700 hover:text-blue-900">
          365d
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left font-medium px-3 py-2">utm_content</th>
              <th className="text-right font-medium px-3 py-2">Attribution sets</th>
              <th className="text-right font-medium px-3 py-2">Outbound clicks</th>
              <th className="text-right font-medium px-3 py-2">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-gray-600" colSpan={4}>
                  Geen data.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.utm_content} className="align-top">
                  <td className="px-3 py-2 text-gray-900 font-medium whitespace-nowrap">
                    {r.utm_content}
                  </td>
                  <td className="px-3 py-2 text-gray-800 text-right whitespace-nowrap">
                    {r.attribution_set_total}
                  </td>
                  <td className="px-3 py-2 text-gray-800 text-right whitespace-nowrap">
                    {r.outbound_click_total}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Link
                      href={`/admin/posts/${encodeURIComponent(r.utm_content)}?days=${safeDays}`}
                      className="text-blue-700 hover:text-blue-900"
                    >
                      Bekijk
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
