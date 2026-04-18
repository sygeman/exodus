import type { ElectrobunConfig } from "electrobun"
import path from "path"
import { readFileSync } from "fs"

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"))

const aliasPlugin = {
  name: "alias-resolver",
  setup(build: any) {
    build.onResolve({ filter: /^@\// }, (args: any) => {
      let resolved = path.resolve(process.cwd(), "src", args.path.slice(2))
      if (!path.extname(resolved)) {
        resolved += ".ts"
      }
      return { path: resolved }
    })
  },
}

export default {
  app: {
    name: "Exodus",
    identifier: "exodus.sgmn.dev",
    version: packageJson.version,
  },
  release: {
    baseUrl: "https://github.com/sygeman/exodus/releases/latest/download",
    generatePatch: process.env.CI === "true",
  },
  build: {
    bun: {
      plugins: [aliasPlugin],
    },
    // Vite builds to dist/, we copy from there
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    watch: ["src/lib/**", "src/modules/**"],
    // Ignore Vite output in watch mode — HMR handles view rebuilds separately
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: false,
      icons: "assets/icon.iconset",
    },
    linux: {
      bundleCEF: true,
      icon: "assets/linux/icon_256x256.png",
    },
  },
} satisfies ElectrobunConfig
