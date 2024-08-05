import { defineConfig } from "vite";
import autoprefixer from "autoprefixer";
import postcssPresetEnv from "postcss-preset-env";

export default defineConfig({
  build: {
    lib: {
      entry: "./lib/main.ts",
      name: "OffsetsInjectionReview",
      fileName: "offsets-injection-review",
    },
  },
  css: {
    postcss: {
      plugins: [
        autoprefixer({}),
        postcssPresetEnv({
          stage: 0,
        }),
      ],
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
