import type { Metadata } from "next";
import Link from "next/link";
import {
  getEventCountForUtmContent,
  getOutboundClicksByRetailerForUtmContent,
  getRecentEventsForUtmContent,
} from "@/lib/eventsDb";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Post Detail",
  robots: { index: false, follow: false },
};

export default async function AdminPostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ utmContent: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { utmContent } = await params;
  const sp = (await searchParams) ?? {};
  const daysRaw = sp.days;
  const days = Array.isArray(daysRaw) ? Number(daysRaw[0]) : Number(daysRaw ?? 30);
  const safeDays = Number.isFinite(days) ? Math.min(Math.max(Math.floor(days), 1), 365) : 30;

  const [attribTotal, outboundByRetailer, recent] = await Promise.all([
    getEventCountForUtmContent({ eventName: "attribution_set", utmContent, days: safeDays }),
    getOutboundClicksByRetailerForUtmContent({ utmContent, days: safeDays, limit: 2000 }),
    getRecentEventsForUtmContent({ utmContent, days: safeDays, limit: 200 }),
  ]);

  const outboundTotal = outboundByRetailer.reduce((acc, r) => acc + (r.count ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Post detail</h1>
          <p className="text-sm text-gray-600 mt-1">utm_content: {utmContent}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/admin/posts?days=${safeDays}`} className="text-sm text-blue-700 hover:text-blue-900">
            Terug
          </Link>
          <a
            href={`/admin/export/events?utm_content=${encodeURIComponent(utmContent)}&days=${safeDays}&limit=50000`}
            className="text-sm text-blue-700 hover:text-blue-900"
          >
            Export (CSV)
          </a>
        </div>
      </div>

      <p className="text-sm text-gray-600 mt-2">Laatste {safeDays} dagen.</p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Attribution sets</div>
          <div className="text-2xl font-bold mt-1">{attribTotal}</div>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Outbound clicks</div>
          <div className="text-2xl font-bold mt-1">{outboundTotal}</div>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Outbound clicks per retailer</h2>
        <div className="mt-3 overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left font-medium px-3 py-2">Retailer</th>
                <th className="text-right font-medium px-3 py-2">Clicks</th>
                <th className="text-left font-medium px-3 py-2">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {outboundByRetailer.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-gray-600" colSpan={3}>
                    Geen data.
                  </td>
                </tr>
              ) : (
                outboundByRetailer.map((r, idx) => (
                  <tr key={`${r.retailer ?? ""}-${idx}`}>
                    <td className="px-3 py-2 text-gray-900 font-medium whitespace-nowrap">
                      {r.retailer ?? ""}
                    </td>
                    <td className="px-3 py-2 text-gray-800 text-right whitespace-nowrap">{r.count}</td>
                    <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{r.last_seen_at}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Recente events</h2>
        <div className="mt-3 overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left font-medium px-3 py-2">Tijd</th>
                <th className="text-left font-medium px-3 py-2">Event</th>
                <th className="text-left font-medium px-3 py-2">Retailer</th>
                <th className="text-left font-medium px-3 py-2">Pad</th>
                <th className="text-left font-medium px-3 py-2">Destination</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recent.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-gray-600" colSpan={5}>
                    Geen data.
                  </td>
                </tr>
              ) : (
                recent.map((e, idx) => (
                  <tr key={`${e.created_at}-${idx}`} className="align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-800">{e.created_at}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                      {e.event_name}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-800">{e.retailer ?? ""}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-800">{e.path ?? ""}</td>
                    <td className="px-3 py-2 text-gray-800">
                      {e.destination_url ? (
                        <a
                          href={e.destination_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 hover:text-blue-900 break-all"
                        >
                          {e.destination_url}
                        </a>
                      ) : (
                        ""
                      )}
                    </td>
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
