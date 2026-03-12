import type { Metadata } from "next";
import { getRecentEvents } from "@/lib/eventsDb";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Events",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminEventsPage() {
  const events = await getRecentEvents(100);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Events</h1>
        <a href="/" className="text-sm text-blue-700 hover:text-blue-900">
          Naar homepage
        </a>
      </div>

      <p className="text-sm text-gray-600 mt-2">Laatste 100 events</p>

      <div className="mt-6 overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left font-medium px-3 py-2">Tijd</th>
              <th className="text-left font-medium px-3 py-2">Event</th>
              <th className="text-left font-medium px-3 py-2">Pad</th>
              <th className="text-left font-medium px-3 py-2">Retailer</th>
              <th className="text-left font-medium px-3 py-2">UTM content</th>
              <th className="text-left font-medium px-3 py-2">Destination</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-gray-600" colSpan={6}>
                  Geen events gevonden.
                </td>
              </tr>
            ) : (
              events.map((e, idx) => (
                <tr key={`${e.created_at}-${idx}`} className="align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-800">
                    {e.created_at}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                    {e.event_name}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-800">{e.path ?? ""}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-800">{e.retailer ?? ""}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-800">{e.utm_content ?? ""}</td>
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
  );
}
