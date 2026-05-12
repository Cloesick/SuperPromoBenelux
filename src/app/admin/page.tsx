import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminHomePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <a href="/" className="text-sm text-blue-700 hover:text-blue-900">
          Naar homepage
        </a>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/admin/events"
          className="block border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition"
        >
          <div className="font-semibold">Events</div>
          <div className="text-sm text-gray-600 mt-1">Laatste events (raw)</div>
        </Link>

        <Link
          href="/admin/engagement"
          className="block border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition"
        >
          <div className="font-semibold">Engagement</div>
          <div className="text-sm text-gray-600 mt-1">Folder engagement metrics</div>
        </Link>

        <Link
          href="/admin/posts"
          className="block border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition"
        >
          <div className="font-semibold">Posts</div>
          <div className="text-sm text-gray-600 mt-1">ROI per utm_content</div>
        </Link>

        <Link
          href="/admin/retailers"
          className="block border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition"
        >
          <div className="font-semibold">Retailers</div>
          <div className="text-sm text-gray-600 mt-1">Aggregaties per retailer</div>
        </Link>

        <Link
          href="/admin/timeseries"
          className="block border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition"
        >
          <div className="font-semibold">Timeseries</div>
          <div className="text-sm text-gray-600 mt-1">Events per dag</div>
        </Link>

        <a
          href="/admin/export/events?days=30&limit=5000"
          className="block border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition"
        >
          <div className="font-semibold">Export events (CSV)</div>
          <div className="text-sm text-gray-600 mt-1">Laatste 30 dagen</div>
        </a>
      </div>
    </div>
  );
}
