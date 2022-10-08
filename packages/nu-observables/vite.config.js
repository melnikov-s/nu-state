import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	build: {
		minify: false,
		lib: {
			entry: resolve(__dirname, "src/index.ts"),
			name: "nu-observables",
			fileName: (format) => `nu-observables.${format}.js`,
		},
		rollupOptions: {},
	},
	test: {
		globals: true,
	},
	plugins: [dts()],
});
