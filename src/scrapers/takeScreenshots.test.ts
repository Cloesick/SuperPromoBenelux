import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BaseScraper, type ScrapeContext } from "./base";

class TestScraper extends BaseScraper {
	config = {
		slug: "test",
		name: "Test",
		folderUrls: ["https://example.com"],
	};

	public async takeScreenshotsPublic(ctx: ScrapeContext, overrideUrl?: string) {
		return this.takeScreenshots(ctx, overrideUrl);
	}
}

describe("BaseScraper.takeScreenshots", () => {
	const realDateNow = Date.now;

	beforeEach(() => {
		vi.spyOn(Date, "now").mockReturnValue(
			new Date("2026-04-04T12:00:00.000Z").valueOf(),
		);
	});

	afterEach(() => {
		Date.now = realDateNow;
		vi.restoreAllMocks();
	});

	function makeCtx(page: any): ScrapeContext {
		return {
			page,
			browser: {} as any,
			interceptedUrls: {
				pdfs: [],
				publitas: [],
				ipaper: [],
				yumpu: [],
				issuu: [],
				apiJson: [],
				images: [],
			},
			sourceUrls: [],
			methods: [],
		};
	}

	it("iterates Issuu pageNumber when overrideUrl is an issuu embed", async () => {
		const goto = vi.fn(async () => undefined);
		const screenshot = vi.fn(async () => undefined);
		const url = vi.fn(
			() => "https://e.issuu.com/embed.html?u=x&d=y&pageNumber=1",
		);

		const page = {
			goto,
			screenshot,
			url,
		} as any;

		process.env.MAX_SCREENSHOT_PAGES = "3";

		const scraper = new TestScraper();
		const result = await scraper.takeScreenshotsPublic(
			makeCtx(page),
			"https://e.issuu.com/embed.html?u=x&d=y&pageNumber=1",
		);

		expect(result.pages).toHaveLength(3);
		expect(goto).toHaveBeenCalledWith(
			expect.stringContaining("pageNumber=1"),
			expect.anything(),
		);
		expect(goto).toHaveBeenCalledWith(
			expect.stringContaining("pageNumber=2"),
			expect.anything(),
		);
		expect(goto).toHaveBeenCalledWith(
			expect.stringContaining("pageNumber=3"),
			expect.anything(),
		);
		expect(screenshot).toHaveBeenCalledTimes(3);
	});

	it("iterates Publitas /page/<n> when overrideUrl is a publitas viewer", async () => {
		const goto = vi.fn(async () => undefined);
		const screenshot = vi.fn(async () => undefined);
		const url = vi.fn(
			() => "https://view.publitas.com/x/y/page/1?publitas_embed=embedded",
		);

		const page = {
			goto,
			screenshot,
			url,
		} as any;

		process.env.MAX_SCREENSHOT_PAGES = "2";

		const scraper = new TestScraper();
		const result = await scraper.takeScreenshotsPublic(
			makeCtx(page),
			"https://view.publitas.com/x/y/page/1?publitas_embed=embedded",
		);

		expect(result.pages).toHaveLength(2);
		const calls = goto.mock.calls as unknown as unknown[][];
		const calledUrls = calls.map((c) => String(c[0]));
		expect(calledUrls.some((u) => u.includes("/page/1"))).toBe(true);
		expect(calledUrls.some((u) => u.includes("/page/2"))).toBe(true);
		expect(screenshot).toHaveBeenCalledTimes(2);
	});
});
