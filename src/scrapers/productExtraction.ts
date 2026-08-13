export interface ExtractedProduct {
	brand: string | null;
	name: string;
	variant: string | null;
	sizeText: string | null;
	priceCents: number | null;
	originalPriceCents: number | null;
	promoLabel: string | null;
	confidence: number;
}

/* Cents rather than euros because floating point money silently rounds, and a
 * price that is wrong by a cent is a trust problem on a comparison site. */
export const EXTRACTION_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["products"],
	properties: {
		products: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"brand",
					"name",
					"variant",
					"sizeText",
					"priceCents",
					"originalPriceCents",
					"promoLabel",
					"confidence",
				],
				properties: {
					brand: { type: ["string", "null"] },
					name: { type: "string" },
					variant: { type: ["string", "null"] },
					sizeText: { type: ["string", "null"] },
					priceCents: { type: ["integer", "null"] },
					originalPriceCents: { type: ["integer", "null"] },
					promoLabel: { type: ["string", "null"] },
					confidence: { type: "number" },
				},
			},
		},
	},
} as const;

export const EXTRACTION_PROMPT = `Je krijgt één pagina uit een Belgische supermarktfolder.

Lijst elk product op dat een zichtbare prijs of promotie heeft.

Regels:
- priceCents en originalPriceCents zijn gehele getallen in eurocent. €4,49 is 449.
- Kun je een waarde niet duidelijk lezen? Gebruik null. Do not guess a price, a brand or a size — een verzonnen prijs is erger dan een ontbrekende prijs.
- sizeText is de inhoud exact zoals gedrukt, bijvoorbeeld "1,5 L" of "6 x 33 cl".
- promoLabel is de promotietekst zoals gedrukt, bijvoorbeeld "2+1 gratis" of "-30%".
- confidence is 0 tot 1: hoe zeker je bent dat naam én prijs correct gelezen zijn.
- Negeer winkelinformatie, openingsuren, algemene voorwaarden en reclame zonder prijs.`;
