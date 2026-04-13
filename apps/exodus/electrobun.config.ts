import type { ElectrobunConfig } from "electrobun";
import path from "path";

const aliasPlugin = {
  name: "alias-resolver",
  setup(build: any) {
    build.onResolve({ filter: /^@\// }, (args: any) => {
      let resolved = path.resolve(process.cwd(), "src", args.path.slice(2));
      if (!path.extname(resolved)) {
        resolved += ".ts";
      }
      return { path: resolved };
    });
  },
};

export default {
  app: {
    name: "Exodus",
    identifier: "exodus.sgmn.dev",
    version: "0.0.1",
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
    },
    linux: {
      bundleCEF: false,
    },
    win: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig;
