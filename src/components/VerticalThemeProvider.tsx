"use client";

import { createContext, useContext } from "react";
import type { VerticalConfig } from "@/lib/types";
import { VERTICAL_CONFIGS } from "@/lib/types";

const VerticalContext = createContext<VerticalConfig>(VERTICAL_CONFIGS.general);

export function VerticalThemeProvider({
	config,
	children,
}: {
	config: VerticalConfig;
	children: React.ReactNode;
}) {
	return (
		<VerticalContext.Provider value={config}>
			{children}
		</VerticalContext.Provider>
	);
}

export function useVerticalTheme() {
	return useContext(VerticalContext);
}
