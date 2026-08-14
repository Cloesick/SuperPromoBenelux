import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getComparableProducts, getProductBySlug } from "@/lib/catalogDb";
import { getRetailerBySlug } from "@/lib/retailers";

/* Leaflets change weekly, so hourly revalidation is far more often than the
 * data moves. It exists to pick up mid-week corrections from the review queue,
 * not to track prices. */
export const revalidate = 3600;

export async function generateStaticParams() {
	const products = await getComparableProducts();
	return products.map((p) => ({ product: p.slug }));
}

function euro(cents: number): string {
	return `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function displayName(p: {
	brand: string | null;
	name: string;
	variant: string | null;
}): string {
	return [p.brand, p.name, p.variant].filter(Boolean).join(" ");
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ product: string }>;
}): Promise<Metadata> {
	const { product } = await params;
	const data = await getProductBySlug(product);
	if (!data) return { title: "Product niet gevonden" };

	const name = displayName(data.product);
	const cheapest = data.offers[0];

	return {
		title: `${name} prijs vergelijken — waar het goedkoopst?`,
		description: cheapest
			? `${name} kost deze week vanaf ${euro(cheapest.price_cents)}. Vergelijk de folderprijs bij ${data.product.retailer_count} supermarkten.`
			: `Vergelijk de folderprijs van ${name} bij Belgische supermarkten.`,
		alternates: { canonical: `/prijzen/${product}` },
	};
}

export default async function ProductPage({
	params,
}: {
	params: Promise<{ product: string }>;
}) {
	const { product } = await params;
	const data = await getProductBySlug(product);

	// getProductBySlug already enforces the two-retailer rule, so a miss here is
	// either an unknown slug or a product that stopped being comparable.
	if (!data) notFound();

	const name = displayName(data.product);
	const cheapest = data.offers[0];

	return (
		<div className="max-w-3xl mx-auto px-4 py-8">
			<h1 className="text-2xl font-bold text-gray-900 mb-2">
				{name} — waar het goedkoopst?
			</h1>
			<p className="text-gray-600 mb-6">
				Vergeleken bij {data.product.retailer_count} supermarkten, op basis van
				de folders van deze week.
			</p>

			<div className="overflow-x-auto">
				<table className="w-full border-collapse">
					<caption className="sr-only">
						Folderprijs van {name} per supermarkt, goedkoopste eerst
					</caption>
					<thead>
						<tr className="border-b border-gray-200 text-left text-sm text-gray-500">
							<th scope="col" className="py-2 font-medium">
								Winkel
							</th>
							<th scope="col" className="py-2 font-medium">
								Prijs
							</th>
							<th scope="col" className="py-2 font-medium">
								Promotie
							</th>
						</tr>
					</thead>
					<tbody>
						{data.offers.map((offer) => {
							const retailer = getRetailerBySlug(offer.retailer_slug);
							const isCheapest = offer.price_cents === cheapest.price_cents;
							return (
								<tr
									key={`${offer.retailer_slug}-${offer.valid_until}`}
									className="border-b border-gray-100"
								>
									<td className="py-3">
										<Link
											href={`/folders/${offer.retailer_slug}`}
											className="hover:underline"
										>
											{retailer?.name ?? offer.retailer_slug}
										</Link>
									</td>
									<td className="py-3 font-semibold tabular-nums">
										{euro(offer.price_cents)}
										{isCheapest && (
											<span className="ml-2 text-xs font-medium text-green-700">
												goedkoopst
											</span>
										)}
									</td>
									<td className="py-3 text-sm text-gray-600">
										{/* Multi-buy labels are rendered as printed. "2+1 gratis"
										    has no comparable unit price, and inventing one would
										    misrank it against a straight discount. */}
										{offer.promo_label ?? "—"}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
