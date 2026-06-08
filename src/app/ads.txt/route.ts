export const dynamic = "force-static";

export function GET(): Response {
	const body =
		process.env.ADS_TXT ??
		process.env.NEXT_PUBLIC_ADSENSE_ADS_TXT ??
		"";

	return new Response(body.trim() + "\n", {
		headers: {
			"content-type": "text/plain; charset=utf-8",
			"cache-control": "public, max-age=3600",
		},
	});
}
