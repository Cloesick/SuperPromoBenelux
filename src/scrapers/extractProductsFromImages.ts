import Anthropic from "@anthropic-ai/sdk";
import {
	EXTRACTION_PROMPT,
	EXTRACTION_SCHEMA,
	type ExtractedProduct,
} from "./productExtraction";

export interface PageRef {
	/** Stable id we can map results back to: `${folderId}:${pageNumber}`. */
	customId: string;
	imageUrl: string;
}

/* Sonnet 5 rather than Haiku 4.5 because it reads at 2576px on the long edge;
 * Haiku predates high-resolution vision and caps at 1568px. Leaflets are dense,
 * with small print and superscript cents, so resolution is the binding
 * constraint -- not reasoning ability and not price. */
const MODEL = "claude-sonnet-5";

function getClient(): Anthropic | null {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) return null;
	return new Anthropic({ apiKey });
}

/**
 * Leaflets refresh weekly and nobody is waiting on the result, so extraction
 * runs through the Batch API: same model, half the price. Returns the batch id
 * to poll later, or null when no key is configured.
 */
export async function submitExtractionBatch(
	pages: PageRef[],
): Promise<string | null> {
	const client = getClient();
	if (!client || pages.length === 0) return null;

	const batch = await client.messages.batches.create({
		requests: pages.map((page) => ({
			custom_id: page.customId,
			params: {
				model: MODEL,
				max_tokens: 8000,
				output_config: {
					format: { type: "json_schema" as const, schema: EXTRACTION_SCHEMA },
				},
				messages: [
					{
						role: "user" as const,
						content: [
							{
								type: "image" as const,
								source: { type: "url" as const, url: page.imageUrl },
							},
							{ type: "text" as const, text: EXTRACTION_PROMPT },
						],
					},
				],
			},
		})),
	});

	return batch.id;
}

export async function isBatchReady(batchId: string): Promise<boolean> {
	const client = getClient();
	if (!client) return false;
	const batch = await client.messages.batches.retrieve(batchId);
	return batch.processing_status === "ended";
}

/**
 * Results arrive in any order, so they are keyed by custom_id rather than
 * position. A failed page yields no entry at all rather than an empty one, so
 * callers can distinguish "no products on this page" from "this page did not
 * run" -- which matters when deciding whether to re-submit.
 */
export async function collectExtractionBatch(
	batchId: string,
): Promise<Map<string, ExtractedProduct[]>> {
	const client = getClient();
	const out = new Map<string, ExtractedProduct[]>();
	if (!client) return out;

	for await (const result of await client.messages.batches.results(batchId)) {
		if (result.result.type !== "succeeded") {
			console.error(
				`[extraction] page ${result.custom_id} failed: ${result.result.type}`,
			);
			continue;
		}

		const block = result.result.message.content.find((b) => b.type === "text");
		if (!block || block.type !== "text") continue;

		try {
			const parsed = JSON.parse(block.text) as { products: ExtractedProduct[] };
			out.set(result.custom_id, parsed.products ?? []);
		} catch (err) {
			console.error(`[extraction] page ${result.custom_id} unparseable:`, err);
		}
	}

	return out;
}
