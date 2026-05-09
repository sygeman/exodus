import type { Stage, StageInput, StageOutput, OutputFile, IR } from "../ir"
import { capitalize } from "../utils"

// ── Vue Stage ─────────────────────────────────────────────────────────────────
// Generates Vue renderer files: App.vue, main.ts, router, css, env.d.ts.

export const vueStage: Stage = {
  name: "vue",

  async handle({ ir }: StageInput): Promise<StageOutput> {
    const files: OutputFile[] = []

    files.push({
      path: "src/App.vue",
      content: generateApp(ir),
    })

    files.push({
      path: "src/main.ts",
      content: generateMain(ir),
    })

    files.push({
      path: "src/router.ts",
      content: generateRouter(ir),
    })

    files.push({
      path: "src/app.css",
      content: generateAppCss(),
    })

    files.push({
      path: "src/env.d.ts",
      content: generateEnvDts(ir),
    })

    files.push({
      path: "vite.config.ts",
      content: generateViteConfig(ir),
    })

    files.push({
      path: "index.html",
      content: generateIndexHtml(ir),
    })

    files.push({
      path: "tsconfig.json",
      content: generateTsconfig(),
    })

    const deps = ["vue", "vue-router", "@nuxt/ui", "tailwindcss"]
    const devDeps = ["@vitejs/plugin-vue", "typescript", "vite", "vue-tsc", "@types/bun"]

    if (ir.assets.length > 0) {
      devDeps.push("vite-svg-loader")
    }

    const scripts = {
      dev: "vite build && electrobun dev --watch",
      "dev:webview": "vite --port 5173",
      build: "vite build",
      "build:stable": "vite build && electrobun build --env=stable",
      icons: "./scripts/generate-icons.sh",
    }

    return { files, deps, devDeps, scripts }
  },
}

// ── Generators ────────────────────────────────────────────────────────────────

function generateApp(ir: IR): string {
  if (ir.layout.hasAppLayout) {
    return `<script setup lang="ts">
import AppLayout from "@/components/AppLayout.vue"
</script>

<template>
  <UApp>
    <AppLayout />
  </UApp>
</template>
`
  }

  return `<script setup lang="ts">
import { RouterView } from "vue-router"
</script>

<template>
  <UApp>
    <RouterView />
  </UApp>
</template>
`
}

function generateMain(ir: IR): string {
  const splashDismiss = ir.platform.features.splash
    ? `
setTimeout(() => {
  const splash = document.getElementById("splash")
  if (splash) {
    splash.classList.add("fade-out")
    splash.addEventListener("transitionend", () => splash.remove(), { once: true })
  }
}, ${ir.platform.features.splash.duration})`
    : ""

  return `import "./app.css"
import ui from "@nuxt/ui/vue-plugin"
import { createApp } from "vue"
import App from "./App.vue"
import router from "./router"
import { rpc } from "./edem-bridge"
import { Electroview } from "electrobun/view"

void new Electroview({ rpc })

const app = createApp(App)
app.use(router)
app.use(ui)
app.mount("#app")${splashDismiss}
`
}

function generateRouter(ir: IR): string {
  const imports = new Set<string>()
  const entries: string[] = []

  function processRoute(route: import("../ir").IRRoute, indent: string): string {
    const parts: string[] = []
    parts.push(`path: "${route.path}"`)

    if (route.redirect) {
      parts.push(`redirect: "${route.redirect}"`)
    }

    if (route.componentName) {
      imports.add(`import ${route.componentName} from "@/components/${route.componentName}.vue"`)
      const name = route.name ? `name: "${route.name}", ` : ""
      const props = route.params.length > 0 ? "props: true, " : ""
      parts.push(`${name}${props}component: ${route.componentName}`)
    }

    if (route.children && route.children.length > 0) {
      const childEntries = route.children.map((child) => processRoute(child, indent + "  "))
      parts.push(`children: [\n${childEntries.join("\n")}\n${indent}]`)
    }

    return `${indent}{ ${parts.join(", ")} },`
  }

  for (const route of ir.routes) {
    entries.push(processRoute(route, "    "))
  }

  return `import { createRouter, createWebHashHistory } from "vue-router"

${[...imports].join("\n")}

const routes = [
${entries.join("\n")}
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
`
}

function generateAppCss(): string {
  return `@import "tailwindcss";
@import "@nuxt/ui";
`
}

function generateEnvDts(ir: IR): string {
  let content = `/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue"
  const component: DefineComponent<{}, {}, any>
  export default component
}
`

  if (ir.assets.length > 0) {
    content += `
declare module "*.svg" {
  import type { DefineComponent } from "vue"
  const component: DefineComponent
  export default component
}
`
  }

  return content
}

function generateViteConfig(ir: IR): string {
  const plugins = [
    "    vue(),",
    `    ui({`,
    `      colorMode: true,`,
    `      ui: {`,
    `        colors: {`,
    `          primary: "amber",`,
    `          neutral: "neutral",`,
    `        },`,
    `      },`,
    `    }),`,
  ]

  if (ir.assets.length > 0) {
    plugins.push("    svgLoader(),")
  }

  return `import ui from "@nuxt/ui/vite"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import path from "path"
${ir.assets.length > 0 ? 'import svgLoader from "vite-svg-loader"\n' : ""}
export default defineConfig({
  plugins: [
${plugins.join("\n")}
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
`
}

function generateIndexHtml(ir: IR): string {
  const title = capitalize(ir.project.name)
  const hasSplash = !!ir.platform.features.splash

  const splashStyle = hasSplash
    ? `    <style>
      #splash {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle at 50% 50%, #1c1917 0%, #0a0a0a 100%);
        color: #fafaf9;
        z-index: 9999;
        transition: opacity 0.3s ease;
        overflow: hidden;
      }
      #splash::before {
        content: "";
        position: absolute;
        inset: -50%;
        background:
          radial-gradient(circle at 30% 30%, rgba(245, 158, 11, 0.12) 0%, transparent 50%),
          radial-gradient(circle at 70% 70%, rgba(120, 113, 108, 0.08) 0%, transparent 50%);
        animation: splashPulse 4s ease-in-out infinite;
      }
      @keyframes splashPulse {
        0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.8; }
        50% { transform: scale(1.1) rotate(3deg); opacity: 1; }
      }
      #splash.fade-out { opacity: 0; pointer-events: none; }
      #splash-content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        animation: splashFadeIn 0.6s ease-out;
      }
      #splash-content img {
        width: 64px;
        height: 64px;
        opacity: 0;
        animation: splashIconIn 0.5s ease-out 0.1s both;
      }
      #splash h1 {
        position: relative;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 1.75rem;
        font-weight: 500;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        margin: 0;
      }
      #splash h1::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: -8px;
        width: 24px;
        height: 2px;
        background: rgba(245, 158, 11, 0.6);
        transform: translateX(-50%);
        animation: splashLine 0.8s ease-out 0.3s both;
      }
      @keyframes splashIconIn {
        from { opacity: 0; transform: scale(0.8); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes splashFadeIn {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes splashLine {
        from { width: 0; opacity: 0; }
        to { width: 24px; opacity: 1; }
      }
    </style>`
    : ""

  const splashBody = hasSplash
    ? `    <div id="splash">
      <div id="splash-content">
        <img src="/src/assets/logo.svg" alt="${title}" />
        <h1>${title}</h1>
      </div>
    </div>
`
    : ""

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
${splashStyle}
  </head>
  <body>
${splashBody}    <div id="app" class="isolate"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`
}

function generateTsconfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ESNext",
        useDefineForClassFields: true,
        module: "ESNext",
        resolveJsonModule: true,
        allowJs: true,
        isolatedModules: true,
        moduleDetection: "force",
        noEmit: true,
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        moduleResolution: "bundler",
        skipLibCheck: true,
        paths: {
          "@/*": ["./src/*"],
        },
      },
      include: ["src/**/*.ts", "src/**/*.vue"],
      exclude: ["node_modules", "dist"],
    },
    null,
    2,
  )
}
