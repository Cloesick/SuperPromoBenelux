import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	// Mirrors the "@/*" -> "src/*" path alias in tsconfig. Components previously
	// only imported types under this alias, which the transform strips, so a
	// value import was the first to actually need resolution here.
	resolve: {
		alias: { "@": path.resolve(__dirname, "./src") },
	},
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		include: ["src/**/*.test.tsx"],
	},
});
