import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "vue-app",
    identifier: "vueapp.electrobun.dev",
    version: "0.0.1",
  },
  build: {
    // bun: {
    // 	entrypoint: "src/core/backend.ts",
    // },
    // Vite builds to dist/, we copy from there
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    watch: ["src/lib/**"],
    // Ignore Vite output in watch mode — HMR handles view rebuilds separately
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: false,
    },
    linux: {
      bundleCEF: false,
    },
    win: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig;
