import type { Stage, StageInput, StageOutput, OutputFile, IR } from "../ir"

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
      content: generateMain(),
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
      content: generateEnvDts(),
    })

    files.push({
      path: "vite.config.ts",
      content: generateViteConfig(),
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

    const scripts = {
      dev: "vite build && electrobun dev --watch",
      "dev:webview": "vite --port 5173",
      build: "vite build",
      "build:stable": "vite build && electrobun build --env=stable",
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

function generateMain(): string {
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
app.mount("#app")
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

function generateEnvDts(): string {
  return `/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue"
  const component: DefineComponent<{}, {}, any>
  export default component
}
`
}

function generateViteConfig(): string {
  return `import ui from "@nuxt/ui/vite"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import path from "path"

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
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="app" class="isolate"></div>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
