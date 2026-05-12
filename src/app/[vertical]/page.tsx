import { VERTICALS, VERTICAL_CONFIGS, Vertical } from "@/lib/types";
import { getRetailersForVertical } from "@/lib/retailers";
import { RetailerCard } from "@/components/RetailerCard";
import { Zap } from "lucide-react";
import Link from "next/link";

interface PageProps {
	params: Promise<{ vertical: string }>;
}

export async function generateStaticParams() {
	return VERTICALS.filter((v) => v !== "general").map((v) => ({ vertical: v }));
}

export default async function VerticalHomePage({ params }: PageProps) {
	const { vertical } = await params;
	const config = VERTICAL_CONFIGS[vertical as Vertical];
	const retailers = getRetailersForVertical(vertical as Vertical);

	return (
		<>
			<section
				className="text-white"
				style={{ background: `linear-gradient(135deg, ${config.color}, ${config.color}dd)` }}
			>
				<div className="max-w-6xl mx-auto px-4 py-20 text-center">
					<h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
						{config.name}
						<br />
						<span className="text-amber-300">{config.description}</span>
					</h1>
					<p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-8">
						Bekijk de nieuwste folders en promoties van {retailers.length} winkels.
					</p>
					<Link
						href={`/${vertical}/folders`}
						className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold px-8 py-3 rounded-lg transition"
					>
						<Zap className="w-5 h-5" />
						Bekijk alle folders
					</Link>
				</div>
			</section>

			<section className="max-w-6xl mx-auto px-4 py-12">
				<h2 className="text-2xl font-bold text-gray-900 mb-8">Winkels</h2>
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
					{retailers.map((r) => (
						<RetailerCard key={r.slug} retailer={r} basePath={`/${vertical}`} />
					))}
				</div>
			</section>
		</>
	);
}
