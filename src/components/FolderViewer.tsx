"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
	ChevronLeft,
	ChevronRight,
	Calendar,
	FileText,
	Maximize2,
} from "lucide-react";
import { Folder, Retailer } from "@/lib/types";

interface FolderViewerProps {
	folder: Folder;
	retailer: Retailer;
}

export function FolderViewer({ folder, retailer }: FolderViewerProps) {
	const hasEmbed = !!folder.embedUrl;
	const hasPdf = !!folder.pdfUrl;
	const hasPages = folder.pages.length > 0;
	const forcePagesOnly = retailer.slug === "colruyt" && hasPages;

	// Detect expired folders — Publitas embeds go offline after validUntil
	const isExpired = (() => {
		try {
			const until = new Date(folder.validUntil + "T23:59:59");
			return until < new Date();
		} catch {
			return false;
		}
	})();

	// Detect stale data — warn users when scraped data is old
	const [dataAgeHours, setDataAgeHours] = useState<number | null>(null);
	const isStale = dataAgeHours !== null && dataAgeHours > 72; // > 3 days

	// Detect embed host for X-Frame-Options / CSP blocking
	const embedHost = (() => {
		if (!folder.embedUrl) return null;
		try {
			return new URL(folder.embedUrl).hostname;
		} catch {
			return null;
		}
	})();

	// Block embeds from hosts known to reject iframes (X-Frame-Options: SAMEORIGIN/DENY)
	const isEmbedBlocked =
		!!embedHost &&
		(retailer.slug === "delhaize" ||
			embedHost === "ah.be" ||
			embedHost.endsWith(".ah.be") ||
			embedHost === "folder.aldi.be" ||
			embedHost.endsWith(".folder.aldi.be") ||
			embedHost === "view.publitas.com" ||
			embedHost.endsWith(".publitas.com"));

	// When expired, treat embed/PDF from known-offline hosts as unavailable
	const isEmbedOfflineRisk =
		isExpired &&
		!!folder.embedUrl &&
		/publitas\.com|folderz\.be/i.test(folder.embedUrl);
	const isPdfOfflineRisk =
		isExpired &&
		!!folder.pdfUrl &&
		/publitas\.com|folderz\.be/i.test(folder.pdfUrl);

	const hasEmbedEffective = forcePagesOnly
		? false
		: isEmbedBlocked || isEmbedOfflineRisk
			? false
			: hasEmbed;
	const hasPdfEffective = forcePagesOnly
		? false
		: isPdfOfflineRisk
			? false
			: hasPdf;
	const thumbsRef = useRef<HTMLDivElement | null>(null);

	const [trackingEnabled, setTrackingEnabled] = useState(false);
	const sentRef = useRef<Set<string>>(new Set());

	const [currentPage, setCurrentPage] = useState(0);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [mode, setMode] = useState<"embed" | "pdf" | "pages">(() => {
		if (forcePagesOnly) return "pages";
		if (hasPages) return "pages";
		if (hasEmbedEffective) return "embed";
		if (hasPdfEffective) return "pdf";
		return "pdf";
	});

	useEffect(() => {
		setCurrentPage(0);
		setIsFullscreen(false);

		if (forcePagesOnly) {
			setMode("pages");
			return;
		}
		if (hasPages) {
			setMode("pages");
			return;
		}
		if (hasEmbedEffective) {
			setMode("embed");
			return;
		}
		if (hasPdfEffective) {
			setMode("pdf");
			return;
		}
		setMode("pdf");
	}, [
		folder.id,
		retailer.slug,
		forcePagesOnly,
		hasEmbedEffective,
		hasPdfEffective,
		hasPages,
	]);

	useEffect(() => {
		try {
			const age =
				(Date.now() - new Date(folder.scrapedAt).getTime()) / 3_600_000;
			setDataAgeHours(age);
		} catch {
			setDataAgeHours(null);
		}
	}, [folder.scrapedAt]);

	useEffect(() => {
		if (!forcePagesOnly) return;
		if (mode !== "pages") setMode("pages");
	}, [forcePagesOnly, mode]);

	useEffect(() => {
		const hasConsent = () => {
			if (typeof document === "undefined") return false;
			return document.cookie
				.split(";")
				.map((c) => c.trim())
				.some(
					(c) =>
						c === "sp_cookie_consent=accepted" ||
						c.startsWith("sp_cookie_consent=accepted"),
				);
		};

		const update = () => setTrackingEnabled(hasConsent());
		update();

		window.addEventListener("sp_consent_changed", update);
		window.addEventListener("storage", update);
		return () => {
			window.removeEventListener("sp_consent_changed", update);
			window.removeEventListener("storage", update);
		};
	}, []);

	useEffect(() => {
		if (!trackingEnabled) return;
		if (typeof window === "undefined") return;

		const send = (event: string, key: string) => {
			if (sentRef.current.has(key)) return;
			sentRef.current.add(key);

			void fetch("/api/engagement", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					event,
					retailer: retailer.slug,
					path: window.location.pathname,
				}),
				keepalive: true,
			}).catch(() => {
				return;
			});
		};

		send("folder_view", "folder_view");

		const t = window.setTimeout(() => {
			send("folder_engaged_15s", "folder_engaged_15s");
		}, 15000);

		const onScroll = () => {
			const doc = document.documentElement;
			const max = doc.scrollHeight - window.innerHeight;
			if (max <= 0) return;
			const pct = (window.scrollY / max) * 100;
			if (pct >= 50) send("folder_scroll_50", "folder_scroll_50");
			if (pct >= 90) send("folder_scroll_90", "folder_scroll_90");
		};

		window.addEventListener("scroll", onScroll, { passive: true });
		onScroll();

		return () => {
			window.clearTimeout(t);
			window.removeEventListener("scroll", onScroll);
		};
	}, [trackingEnabled, retailer.slug]);

	useEffect(() => {
		if (!trackingEnabled) return;
		if (mode !== "pages") return;
		if (typeof window === "undefined") return;

		const key = `folder_page_turn:${currentPage}`;
		if (sentRef.current.has(key)) return;
		sentRef.current.add(key);

		void fetch("/api/engagement", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				event: "folder_page_turn",
				retailer: retailer.slug,
				path: window.location.pathname,
			}),
			keepalive: true,
		}).catch(() => {
			return;
		});
	}, [trackingEnabled, mode, currentPage, retailer.slug]);

	const validFrom = new Date(folder.validFrom).toLocaleDateString("nl-BE", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
	const validUntil = new Date(folder.validUntil).toLocaleDateString("nl-BE", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});

	const canGoPrev = currentPage > 0;
	const canGoNext = currentPage < folder.pages.length - 1;

	const goPrev = () => setCurrentPage((p) => Math.max(0, p - 1));
	const goNext = () =>
		setCurrentPage((p) => Math.min(folder.pages.length - 1, p + 1));

	const scrollThumbs = (dir: "left" | "right") => {
		const el = thumbsRef.current;
		if (!el) return;
		const delta =
			dir === "left"
				? -Math.max(240, el.clientWidth * 0.8)
				: Math.max(240, el.clientWidth * 0.8);
		el.scrollBy({ left: delta, behavior: "smooth" });
	};

	return (
		<div>
			{/* Folder info */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
				<h2 className="text-lg font-semibold text-gray-900">{folder.title}</h2>
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2 text-sm text-gray-500">
						<Calendar className="w-4 h-4" suppressHydrationWarning />
						<span>
							{validFrom} - {validUntil}
						</span>
					</div>
					{hasPdf && (
						<a
							href={folder.pdfUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 transition"
						>
							<FileText className="w-4 h-4" suppressHydrationWarning />
							PDF
						</a>
					)}
				</div>
			</div>

			{isStale && !isExpired && (
				<div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
					<Calendar className="w-4 h-4 shrink-0" suppressHydrationWarning />
					<span>
						Laatst bijgewerkt{" "}
						{dataAgeHours !== null && dataAgeHours >= 24
							? `${Math.round(dataAgeHours / 24)} dagen geleden`
							: "meer dan 3 dagen geleden"}
						.{" "}
						{retailer.website && (
							<a
								href={retailer.website}
								target="_blank"
								rel="noopener noreferrer"
								className="font-medium underline hover:text-blue-800"
							>
								Bekijk {retailer.name} voor de nieuwste aanbiedingen
							</a>
						)}
					</span>
				</div>
			)}

			{(hasEmbedEffective || hasPdfEffective || hasPages) && (
				<div className="flex flex-wrap items-center gap-2 mb-4">
					{hasEmbedEffective && (
						<button
							type="button"
							onClick={() => setMode("embed")}
							className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
								mode === "embed"
									? "bg-blue-700 text-white border-blue-700"
									: "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
							}`}
						>
							Online
						</button>
					)}
					{hasPdfEffective && (
						<button
							type="button"
							onClick={() => setMode("pdf")}
							className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
								mode === "pdf"
									? "bg-blue-700 text-white border-blue-700"
									: "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
							}`}
						>
							PDF
						</button>
					)}
					{hasPages && (
						<button
							type="button"
							onClick={() => setMode("pages")}
							className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
								mode === "pages"
									? "bg-blue-700 text-white border-blue-700"
									: "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
							}`}
						>
							Pagina&apos;s
						</button>
					)}

					<div className="flex-1" />

					{mode === "embed" && hasEmbedEffective && (
						<a
							href={folder.embedUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm font-medium text-gray-600 hover:text-blue-700 transition"
						>
							Open in nieuw tabblad
						</a>
					)}
					{mode === "pdf" && hasPdfEffective && (
						<a
							href={folder.pdfUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm font-medium text-gray-600 hover:text-blue-700 transition"
						>
							Open PDF
						</a>
					)}
				</div>
			)}

			{/* Primary: Embedded folder viewer (iframe) */}
			{mode === "embed" && hasEmbedEffective ? (
				<div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
					<div
						className={`relative ${isFullscreen ? "fixed inset-0 z-50 bg-white" : ""}`}
					>
						{!isFullscreen && (
							<div className="sm:hidden px-6 py-4 border-b border-gray-100 bg-gray-50">
								<p className="text-sm text-gray-600 mb-3">
									Op mobiel wordt de online folder soms geblokkeerd in deze
									pagina.
								</p>
								<div className="flex flex-wrap gap-3">
									<a
										href={folder.embedUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 transition"
									>
										Open in nieuw tabblad
									</a>
									{hasPdf && (
										<a
											href={folder.pdfUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 transition"
										>
											<FileText className="w-4 h-4" suppressHydrationWarning />
											Download PDF
										</a>
									)}
								</div>
							</div>
						)}
						{isFullscreen && (
							<button
								onClick={() => setIsFullscreen(false)}
								className="absolute top-[calc(env(safe-area-inset-top)+1rem)] right-[calc(env(safe-area-inset-right)+1rem)] z-10 bg-white/90 hover:bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 shadow-lg transition"
							>
								Sluiten
							</button>
						)}
						<iframe
							src={folder.embedUrl}
							title={`${retailer.name} folder`}
							className={`w-full border-0 ${
								isFullscreen ? "h-full" : "h-[70dvh] sm:h-[750px] lg:h-[900px]"
							}`}
							allow="fullscreen"
							loading="lazy"
							sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
						/>
					</div>
					{!isFullscreen && (
						<div className="flex items-center justify-end px-6 py-3 border-t border-gray-100">
							<button
								onClick={() => setIsFullscreen(true)}
								className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-700 transition"
							>
								<Maximize2 className="w-4 h-4" suppressHydrationWarning />
								Volledig scherm
							</button>
						</div>
					)}
				</div>
			) : mode === "pdf" && hasPdfEffective ? (
				/* Fallback: PDF viewer */
				<div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
					<div className="sm:hidden p-6 text-center">
						<p className="text-sm text-gray-600 mb-3">
							Op sommige mobiele browsers wordt een PDF niet altijd correct in
							de pagina getoond.
						</p>
						<a
							href={folder.pdfUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 transition"
						>
							<FileText className="w-4 h-4" suppressHydrationWarning />
							Open PDF
						</a>
					</div>

					<iframe
						src={folder.pdfUrl}
						title={`${retailer.name} folder PDF`}
						className="hidden sm:block w-full h-[750px] lg:h-[900px] border-0"
						loading="lazy"
					/>
				</div>
			) : mode === "pages" && hasPages ? (
				/* Fallback: Image page viewer */
				<div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
					<div className="bg-gray-50 px-4 py-5 sm:px-6 sm:py-6">
						<div className="mx-auto w-full max-w-[900px] rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden relative">
							<button
								type="button"
								onClick={goPrev}
								disabled={!canGoPrev}
								className="absolute inset-y-0 left-0 w-[18%] sm:w-[12%] disabled:cursor-not-allowed"
								aria-label="Vorige pagina"
							/>
							<button
								type="button"
								onClick={goNext}
								disabled={!canGoNext}
								className="absolute inset-y-0 right-0 w-[18%] sm:w-[12%] disabled:cursor-not-allowed"
								aria-label="Volgende pagina"
							/>

							<button
								type="button"
								onClick={goPrev}
								disabled={!canGoPrev}
								className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border border-gray-200 rounded-full p-2 shadow-sm disabled:opacity-30 disabled:hover:bg-white/90 disabled:cursor-not-allowed transition"
								aria-label="Vorige pagina"
							>
								<ChevronLeft
									className="w-6 h-6 text-gray-800"
									suppressHydrationWarning
								/>
							</button>
							<button
								type="button"
								onClick={goNext}
								disabled={!canGoNext}
								className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border border-gray-200 rounded-full p-2 shadow-sm disabled:opacity-30 disabled:hover:bg-white/90 disabled:cursor-not-allowed transition"
								aria-label="Volgende pagina"
							>
								<ChevronRight
									className="w-6 h-6 text-gray-800"
									suppressHydrationWarning
								/>
							</button>
							<Image
								src={folder.pages[currentPage].imageUrl}
								alt={`${retailer.name} folder pagina ${currentPage + 1}`}
								width={1200}
								height={1600}
								sizes="(max-width: 768px) 100vw, 900px"
								className="w-full h-auto object-contain bg-white"
								priority={currentPage === 0}
								unoptimized
								suppressHydrationWarning
							/>
						</div>
						<div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
							<button
								onClick={goPrev}
								disabled={!canGoPrev}
								className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-700 disabled:text-gray-300 disabled:cursor-not-allowed transition"
							>
								<ChevronLeft className="w-5 h-5" suppressHydrationWarning />
								Vorige
							</button>
							<span className="text-sm text-gray-500">
								Pagina {currentPage + 1} van {folder.pages.length}
							</span>
							<button
								onClick={goNext}
								disabled={!canGoNext}
								className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-700 disabled:text-gray-300 disabled:cursor-not-allowed transition"
							>
								Volgende
								<ChevronRight className="w-5 h-5" suppressHydrationWarning />
							</button>
						</div>
					</div>
				</div>
			) : isExpired ? (
				<div className="bg-amber-50 border border-amber-200 rounded-xl p-8 sm:p-12 text-center">
					<p className="text-amber-800 font-medium mb-2">
						Deze folder is verlopen
					</p>
					<p className="text-amber-700 text-sm mb-4">
						De nieuwe {retailer.name} folder wordt binnenkort verwacht.
					</p>
					{retailer.website && (
						<a
							href={retailer.website}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 transition"
						>
							Bekijk de website van {retailer.name}
						</a>
					)}
				</div>
			) : (
				<div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
					<p className="text-gray-500">
						De folderpagina&apos;s worden binnenkort geladen.
					</p>
				</div>
			)}

			{/* Page thumbnails (only for image mode) */}
			{mode === "pages" && folder.pages.length > 1 && (
				<div className="mt-4 relative">
					<button
						type="button"
						onClick={() => scrollThumbs("left")}
						className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border border-gray-200 rounded-full p-1.5 shadow-sm"
						aria-label="Scroll thumbnails links"
					>
						<ChevronLeft
							className="w-5 h-5 text-gray-700"
							suppressHydrationWarning
						/>
					</button>
					<button
						type="button"
						onClick={() => scrollThumbs("right")}
						className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border border-gray-200 rounded-full p-1.5 shadow-sm"
						aria-label="Scroll thumbnails rechts"
					>
						<ChevronRight
							className="w-5 h-5 text-gray-700"
							suppressHydrationWarning
						/>
					</button>
					<div ref={thumbsRef} className="flex gap-2 overflow-x-auto pb-2 px-8">
						{folder.pages.map((page, i) => (
							<button
								key={page.pageNumber}
								onClick={() => setCurrentPage(i)}
								className={`shrink-0 w-16 h-22 rounded-md overflow-hidden border-2 transition ${
									i === currentPage
										? "border-blue-600 shadow-sm"
										: "border-gray-200 hover:border-gray-300"
								}`}
							>
								<Image
									src={page.imageUrl}
									alt={`Pagina ${i + 1}`}
									width={64}
									height={88}
									className="object-cover w-full h-full"
									unoptimized
									suppressHydrationWarning
								/>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
