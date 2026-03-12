import type { Metadata } from "next";
import Link from "next/link";
import { getDailyMetrics } from "@/lib/eventsDb";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Timeseries",
  robots: { index: false, follow: false },
};

export default async function AdminTimeseriesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const daysRaw = sp.days;
  const days = Array.isArray(daysRaw) ? Number(daysRaw[0]) : Number(daysRaw ?? 60);
  const safeDays = Number.isFinite(days) ? Math.min(Math.max(Math.floor(days), 1), 365) : 60;

  const metrics = await getDailyMetrics({ days: safeDays });

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Timeseries</h1>
        <Link href="/admin" className="text-sm text-blue-700 hover:text-blue-900">
          Admin
        </Link>
      </div>

      <p className="text-sm text-gray-600 mt-2">Laatste {safeDays} dagen, gegroepeerd per dag en event.</p>

      <div className="mt-3 flex items-center gap-3 text-sm">
        <Link href="/admin/timeseries?days=7" className="text-blue-700 hover:text-blue-900">
          7d
        </Link>
        <Link href="/admin/timeseries?days=30" className="text-blue-700 hover:text-blue-900">
          30d
        </Link>
        <Link href="/admin/timeseries?days=60" className="text-blue-700 hover:text-blue-900">
          60d
        </Link>
        <Link href="/admin/timeseries?days=365" className="text-blue-700 hover:text-blue-900">
          365d
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left font-medium px-3 py-2">Dag</th>
              <th className="text-left font-medium px-3 py-2">Event</th>
              <th className="text-right font-medium px-3 py-2">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {metrics.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-gray-600" colSpan={3}>
                  Geen data.
                </td>
              </tr>
            ) : (
              metrics.map((m, idx) => (
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
  );
}
