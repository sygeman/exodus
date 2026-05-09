import ui from "@nuxt/ui/vite"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import path from "path"
import svgLoader from "vite-svg-loader"

export default defineConfig({
  plugins: [
    vue(),
    ui({
      colorMode: true,
      ui: {
        colors: {
          primary: "amber",
          neutral: "neutral",
        },
      },
    }),
    svgLoader(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
