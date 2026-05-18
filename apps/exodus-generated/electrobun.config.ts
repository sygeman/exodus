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
    identifier: "Exodus.local",
    version: packageJson.version,
  },
  build: {
    bun: {
      plugins: [aliasPlugin],
    },
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    watch: ["src/components/**", "src/composables/**"],
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: false,
      icons: "assets/icon.iconset",
    },
    linux: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig
