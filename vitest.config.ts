import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	// Mirrors the "@/*" -> "src/*" path alias in tsconfig, same as
	// vitest.components.config.ts. sitemap.test.ts is the first node-env test to
	// exercise a module that imports under the alias at runtime.
	resolve: {
		alias: { "@": path.resolve(__dirname, "./src") },
	},
	test: {
		environment: "node",
		globals: true,
		include: ["src/**/*.test.ts"],
	},
});
