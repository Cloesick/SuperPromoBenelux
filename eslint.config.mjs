import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");
const nextTypeScript = require("eslint-config-next/typescript");

const config = [
	...nextCoreWebVitals,
	...nextTypeScript,
	{
		rules: {
			"react-hooks/set-state-in-effect": "off",
			"@typescript-eslint/no-explicit-any": "warn",
			"prefer-rest-params": "off",
			"@next/next/no-html-link-for-pages": "off",
			"@next/next/no-img-element": "warn",
		},
	},
	{
		files: [
			"src/scrapers/**/*.{ts,tsx}",
			"src/**/__tests__/**/*.{ts,tsx}",
			"src/**/*.{test,spec}.{ts,tsx}",
		],
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
		},
	},
	{
		files: ["src/components/MetaPixelGate.tsx"],
		rules: {
			"@next/next/no-img-element": "off",
		},
	},
];

export default config;
