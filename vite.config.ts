import ui from "@nuxt/ui/vite"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import path from "path"

export default defineConfig({
  plugins: [
    vue(),
    ui({
      ui: {
        colors: {
          primary: "amber",
          neutral: "neutral",
        },
      },
    }),
  ],
  root: "src/mainview",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
