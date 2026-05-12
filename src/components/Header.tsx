"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Tag } from "lucide-react";

export function Header() {
	const [mobileOpen, setMobileOpen] = useState(false);

	return (
		<header className="bg-white border-b border-gray-200 sticky top-0 z-50">
			<div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
				<Link
					href="/"
					className="flex items-center gap-2 font-bold text-xl text-blue-700"
				>
					<span suppressHydrationWarning>
						<Tag className="w-6 h-6" suppressHydrationWarning />
					</span>
					<span>SuperPromo</span>
					<span className="text-sm font-normal text-gray-500">België</span>
				</Link>

				<nav className="hidden md:flex items-center gap-8">
					<Link
						href="/"
						className="text-gray-700 hover:text-blue-700 transition font-medium"
					>
						Home
					</Link>
					<Link
						href="/folders"
						className="text-gray-700 hover:text-blue-700 transition font-medium"
					>
						Folders
					</Link>
					<Link
						href="/nl-grensstreek"
						className="text-gray-700 hover:text-blue-700 transition font-medium"
					>
						NL grensstreek
					</Link>
					<Link
						href="/veelgestelde-vragen"
						className="text-gray-700 hover:text-blue-700 transition font-medium"
					>
						FAQ
					</Link>
					<Link
						href="/over-ons"
						className="text-gray-700 hover:text-blue-700 transition font-medium"
					>
						Over Ons
					</Link>
				</nav>

				<button
					className="md:hidden p-2"
					onClick={() => setMobileOpen(!mobileOpen)}
					aria-label="Menu"
				>
					<span suppressHydrationWarning>
						{mobileOpen ? (
							<X className="w-6 h-6" suppressHydrationWarning />
						) : (
							<Menu className="w-6 h-6" suppressHydrationWarning />
						)}
					</span>
				</button>
			</div>

			{mobileOpen && (
				<nav className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3">
					<Link
						href="/"
						className="block text-gray-700 hover:text-blue-700 font-medium"
						onClick={() => setMobileOpen(false)}
					>
						Home
					</Link>
					<Link
						href="/folders"
						className="block text-gray-700 hover:text-blue-700 font-medium"
						onClick={() => setMobileOpen(false)}
					>
						Folders
					</Link>
					<Link
						href="/nl-grensstreek"
						className="block text-gray-700 hover:text-blue-700 font-medium"
						onClick={() => setMobileOpen(false)}
					>
						NL grensstreek
					</Link>
					<Link
						href="/veelgestelde-vragen"
						className="block text-gray-700 hover:text-blue-700 font-medium"
						onClick={() => setMobileOpen(false)}
					>
						FAQ
					</Link>
					<Link
						href="/over-ons"
						className="block text-gray-700 hover:text-blue-700 font-medium"
						onClick={() => setMobileOpen(false)}
					>
						Over Ons
					</Link>
				</nav>
			)}
		</header>
	);
}
