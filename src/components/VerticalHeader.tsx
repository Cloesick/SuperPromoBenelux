"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Home } from "lucide-react";
import { useVerticalTheme } from "./VerticalThemeProvider";

export function VerticalHeader() {
	const [mobileOpen, setMobileOpen] = useState(false);
	const config = useVerticalTheme();
	const { theme, pathPrefix, shortName, icon } = config;

	return (
		<header
			className={`${theme.headerBg} border-b border-gray-200 sticky top-0 z-50`}
		>
			<div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
				<Link
					href={pathPrefix || "/"}
					className={`flex items-center gap-2 font-bold text-xl ${theme.headerText}`}
				>
					<span className="text-2xl" suppressHydrationWarning>
						{icon}
					</span>
					<span>{shortName}</span>
					<span className="text-sm font-normal text-gray-500">SuperPromo</span>
				</Link>

				<nav className="hidden md:flex items-center gap-6">
					<Link
						href="/"
						className={`text-gray-600 ${theme.accentHover} transition font-medium flex items-center gap-1`}
					>
						<Home className="w-4 h-4" suppressHydrationWarning />
						Home
					</Link>
					<Link
						href={`${pathPrefix}/folders`}
						className={`text-gray-700 ${theme.accentHover} transition font-medium`}
					>
						Folders
					</Link>
					<Link
						href="/veelgestelde-vragen"
						className={`text-gray-700 ${theme.accentHover} transition font-medium`}
					>
						FAQ
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
				<nav
					className={`md:hidden border-t border-gray-100 ${theme.headerBg} px-4 py-4 space-y-3`}
				>
					<Link
						href="/"
						className={`block text-gray-700 ${theme.accentHover} font-medium`}
						onClick={() => setMobileOpen(false)}
					>
						Home
					</Link>
					<Link
						href={`${pathPrefix}/folders`}
						className={`block text-gray-700 ${theme.accentHover} font-medium`}
						onClick={() => setMobileOpen(false)}
					>
						Folders
					</Link>
					<Link
						href="/veelgestelde-vragen"
						className={`block text-gray-700 ${theme.accentHover} font-medium`}
						onClick={() => setMobileOpen(false)}
					>
						FAQ
					</Link>
				</nav>
			)}
		</header>
	);
}
