import { NextResponse } from "next/server";

export async function GET(request: Request) {
	const url = new URL(request.url);
	const requireDeals = url.searchParams.get("requireDeals") === "1";

	const baseUrl = new URL(request.url);
	baseUrl.pathname = "/api/inspector/checks";
	baseUrl.search = requireDeals ? "?requireDeals=1" : "";

	const res = await fetch(baseUrl.toString(), { cache: "no-store" });
	if (!res.ok) {
		return NextResponse.json(
			{ error: `Failed to fetch checks: HTTP ${res.status}` },
			{ status: 500 },
		);
	}

	const json = (await res.json()) as {
		generatedAt: string;
		requireDeals: boolean;
		checks: Array<{
			project: string;
			slug: string;
			failing: boolean;
			failureReasons: string[];
			folderCount: number;
			dealCount: number;
			contentSource?: string;
			filePath?: string;
		}>;
	};

	const failing = json.checks
		.filter((c) => c.failing)
		.map((c) => ({
			project: c.project,
			slug: c.slug,
			failureReasons: c.failureReasons,
			folderCount: c.folderCount,
			dealCount: c.dealCount,
			contentSource: c.contentSource,
			filePath: c.filePath,
		}));

	return NextResponse.json({
		generatedAt: json.generatedAt,
		requireDeals: json.requireDeals,
		failingCount: failing.length,
		failing,
	});
}
