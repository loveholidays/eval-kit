import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// Externalize function - exclude all dependencies from the bundle
const external = (id: string) => {
	// Externalize node built-ins
	if (id.startsWith("node:") || ["fs", "path", "stream", "events", "crypto", "url", "util"].includes(id)) {
		return true;
	}
	// Externalize all node_modules dependencies
	if (!id.startsWith(".") && !id.startsWith("/")) {
		return true;
	}
	return false;
};

export default defineConfig({
	plugins: [
		dts({
			include: ["src"],
			exclude: ["src/**/*.spec.ts", "src/**/*.test.ts"],
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "src/index.ts"),
			formats: ["cjs", "es"],
			fileName: (format) => `index.${format === "es" ? "mjs" : "cjs"}`,
		},
		rollupOptions: {
			external,
			output: {
				// Don't preserve modules - bundle everything into single entry files
				// This avoids the complex file naming issues with preserveModules
			},
		},
		sourcemap: true,
		minify: false,
	},
});
