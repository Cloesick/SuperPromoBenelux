import Link from "next/link";
import { Facebook } from "lucide-react";

export function Footer() {
	return (
		<footer className="bg-gray-900 text-gray-300 mt-16">
			<div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
				<div>
					<h3 className="text-white font-bold text-lg mb-3">
						SuperPromo België
					</h3>
					<p className="text-sm leading-relaxed">
						Dagelijks de actuele folders, reclamefolders en promoties van je
						favoriete winkels in België. Bespaar op je boodschappen.
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
							<Link href="/folders" className="hover:text-white transition">
								Alle Folders
							</Link>
						</li>
						<li>
							<Link
								href="/veelgestelde-vragen"
								className="hover:text-white transition"
							>
								Veelgestelde vragen
							</Link>
						</li>
						<li>
							<Link href="/over-ons" className="hover:text-white transition">
								Over Ons
							</Link>
						</li>
						<li>
							<Link href="/privacy" className="hover:text-white transition">
								Privacy
							</Link>
						</li>
						<li>
							<Link href="/contact" className="hover:text-white transition">
								Contact
							</Link>
						</li>
					</ul>
				</div>

				<div>
					<h4 className="text-white font-semibold mb-3">Volg ons</h4>
					<div className="flex gap-4">
						<a
							href="https://www.facebook.com/groups/superpromobelgie"
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-white transition"
							aria-label="Facebook Groep"
						>
							<Facebook className="w-6 h-6" suppressHydrationWarning />
						</a>
					</div>
					<p className="text-sm mt-4">
						Word lid van onze Facebook-groep en mis geen enkele promotie!
					</p>
				</div>
			</div>

			<div className="border-t border-gray-800 text-center text-sm py-4 text-gray-500 space-y-2">
				<p suppressHydrationWarning>
					&copy; {new Date().getFullYear()} SuperPromo België. Alle rechten
					voorbehouden.
				</p>
				<p className="text-xs text-gray-600">
					Sommige links op deze website zijn affiliate links. Dit betekent dat
					wij een kleine commissie kunnen ontvangen als je via onze links een
					aankoop doet, zonder extra kosten voor jou.
				</p>
			</div>
		</footer>
	);
}
