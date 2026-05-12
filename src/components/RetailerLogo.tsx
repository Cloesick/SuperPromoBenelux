import Image from "next/image";
import { Retailer } from "@/lib/types";

interface RetailerLogoProps {
	retailer: Retailer;
	size: number;
	className?: string;
}

function isPlaceholderLogo(logo: string): boolean {
	return logo.includes("/retailers/placeholder.");
}

function getInitials(name: string): string {
	const parts = name
		.split(/[^A-Za-z0-9]+/)
		.map((p) => p.trim())
		.filter(Boolean);
	const initials = parts.map((p) => p[0] ?? "").join("");
	return initials.slice(0, 2).toUpperCase();
}

export function RetailerLogo({ retailer, size, className }: RetailerLogoProps) {
	const testId = "retailer-logo";
	const logo = retailer.logo;

	if (isPlaceholderLogo(logo)) {
		return (
			<div
				data-testid={testId}
				data-retailer-slug={retailer.slug}
				aria-label={`${retailer.name} logo`}
				className={className}
				style={{
					width: size,
					height: size,
					backgroundColor: retailer.color,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontWeight: 700,
					color: "white",
					userSelect: "none",
				}}
			>
				{getInitials(retailer.name)}
			</div>
		);
	}

	const isSvgLogo = logo.toLowerCase().endsWith(".svg");

	return isSvgLogo ? (
		<Image
			data-testid={testId}
			data-retailer-slug={retailer.slug}
			src={logo}
			alt={`${retailer.name} logo`}
			width={size}
			height={size}
			className={className}
			unoptimized
		/>
	) : (
		<Image
			data-testid={testId}
			data-retailer-slug={retailer.slug}
			src={logo}
			alt={`${retailer.name} logo`}
			width={size}
			height={size}
			className={className}
		/>
	);
}
