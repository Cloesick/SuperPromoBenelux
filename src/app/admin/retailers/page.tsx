import type { Metadata } from "next";
import Link from "next/link";
import { getEventTotalCount, getRetailerMetrics } from "@/lib/eventsDb";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Retailers",
  robots: { index: false, follow: false },
};

type Row = {
  retailer: string;
  outbound_click: number;
};

export default async function AdminRetailersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const daysRaw = sp.days;
  const days = Array.isArray(daysRaw) ? Number(daysRaw[0]) : Number(daysRaw ?? 30);
  const safeDays = Number.isFinite(days) ? Math.min(Math.max(Math.floor(days), 1), 365) : 30;

  const [attribTotal, clicks] = await Promise.all([
    getEventTotalCount({ eventName: "attribution_set", days: safeDays }),
    getRetailerMetrics({ eventName: "outbound_click", limit: 2000, days: safeDays }),
  ]);

  const rows: Row[] = clicks
    .map((c) => ({ retailer: c.retailer ?? "", outbound_click: c.count ?? 0 }))
    .filter((r) => r.retailer.length > 0)
    .sort((a, b) => b.outbound_click - a.outbound_click);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Retailers</h1>
        <Link href="/admin" className="text-sm text-blue-700 hover:text-blue-900">
          Admin
        </Link>
      </div>

      <p className="text-sm text-gray-600 mt-2">
        Laatste {safeDays} dagen. Attribution sets totaal: {attribTotal}.
      </p>

      <div className="mt-3 flex items-center gap-3 text-sm">
        <Link href="/admin/retailers?days=7" className="text-blue-700 hover:text-blue-900">
          7d
        </Link>
        <Link href="/admin/retailers?days=30" className="text-blue-700 hover:text-blue-900">
          30d
        </Link>
        <Link href="/admin/retailers?days=60" className="text-blue-700 hover:text-blue-900">
          60d
        </Link>
        <Link href="/admin/retailers?days=365" className="text-blue-700 hover:text-blue-900">
          365d
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left font-medium px-3 py-2">Retailer</th>
              <th className="text-right font-medium px-3 py-2">Outbound clicks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-gray-600" colSpan={2}>
                  Geen data.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.retailer}>
                  <td className="px-3 py-2 text-gray-900 font-medium whitespace-nowrap">
                    {r.retailer}
                  </td>
                  <td className="px-3 py-2 text-gray-800 text-right whitespace-nowrap">
                    {r.outbound_click}
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
