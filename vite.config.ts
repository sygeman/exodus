import ui from "@nuxt/ui/vite"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import path from "path"
import svgLoader from "vite-svg-loader"
import { readFileSync } from "fs"

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"))

export default defineConfig({
  plugins: [
    vue(),
    svgLoader(),
    ui({
      ui: {
        colorMode: true,
        colors: {
          primary: "amber",
          neutral: "neutral",
        },
      },
    }),
  ],
  root: "src",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
