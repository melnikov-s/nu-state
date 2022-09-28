import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	build: {
		minify: false,
		lib: {
			entry: resolve(__dirname, "src/main.ts"),
			name: "rox",
			fileName: (format) => `rox.${format}.js`,
		},
		rollupOptions: {},
	},
	test: {
		globals: true,
	},
	plugins: [dts()],
});
