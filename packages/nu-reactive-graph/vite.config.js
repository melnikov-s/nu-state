import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	build: {
		minify: false,
		lib: {
			entry: resolve(__dirname, "src/index.ts"),
			name: "nu-reactive-graph",
			fileName: (format) => `nu-reactive-graph.${format}.js`,
		},
		rollupOptions: {},
	},
	test: {
		globals: true,
	},
	plugins: [dts()],
});
