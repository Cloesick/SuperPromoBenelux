"use client";

import Link from "next/link";
import { useVerticalTheme } from "./VerticalThemeProvider";

export function VerticalFooter() {
	const config = useVerticalTheme();
	const { theme, pathPrefix, name, description, icon } = config;

	return (
		<footer className={`${theme.footerBg} text-gray-300 mt-16`}>
			<div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
				<div>
					<h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
						<span>{icon}</span>
						{name}
					</h3>
					<p className="text-sm leading-relaxed">
						{description}. Bekijk dagelijks de actuele folders en promoties.
					</p>
				</div>

				<div>
					<h4 className="text-white font-semibold mb-3">Navigatie</h4>
					<ul className="space-y-2 text-sm">
						<li>
							<Link href="/" className="hover:text-white transition">
								Home
							</Link>
						</li>
						<li>
							<Link href={`${pathPrefix}/folders`} className="hover:text-white transition">
								Alle Folders
							</Link>
						</li>
						<li>
							<Link href="/veelgestelde-vragen" className="hover:text-white transition">
								Veelgestelde vragen
							</Link>
						</li>
						<li>
							<Link href="/over-ons" className="hover:text-white transition">
								Over Ons
							</Link>
						</li>
					</ul>
				</div>

				<div>
					<h4 className="text-white font-semibold mb-3">Andere categorieën</h4>
					<ul className="space-y-2 text-sm">
						<li>
							<Link href="/" className="hover:text-white transition">
								🛒 Supermarkten
							</Link>
						</li>
						<li>
							<Link href="/pet" className="hover:text-white transition">
								🐾 Dierenwinkels
							</Link>
						</li>
						<li>
							<Link href="/electro" className="hover:text-white transition">
								⚡ Elektronica
							</Link>
						</li>
						<li>
							<Link href="/fashion" className="hover:text-white transition">
								👗 Mode
							</Link>
						</li>
						<li>
							<Link href="/home-garden" className="hover:text-white transition">
								🏡 Wonen & Tuin
							</Link>
						</li>
						<li>
							<Link href="/beauty" className="hover:text-white transition">
								💄 Beauty
							</Link>
						</li>
						<li>
							<Link href="/diy" className="hover:text-white transition">
								🔨 Doe-het-zelf
							</Link>
						</li>
					</ul>
				</div>
			</div>

			<div className="border-t border-white/10 text-center text-sm py-4 text-gray-400">
				<p suppressHydrationWarning>
					&copy; {new Date().getFullYear()} {name}. Alle rechten voorbehouden.
				</p>
			</div>
		</footer>
	);
}
