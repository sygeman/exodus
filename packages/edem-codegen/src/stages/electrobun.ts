import type { Stage, StageInput, StageOutput, OutputFile, IR } from "../ir"
import { capitalize } from "../utils"
import { readFileSync, readdirSync } from "fs"
import { join } from "path"

// ── Electrobun Stage ──────────────────────────────────────────────────────────
// Generates Electrobun platform files: config, bridge, bun entry, scripts.

export const electrobunStage: Stage = {
  name: "electrobun",

  async handle({ ir }: StageInput): Promise<StageOutput> {
    const files: OutputFile[] = []

    files.push({
      path: "electrobun.config.ts",
      content: generateElectrobunConfig(ir),
    })

    files.push({
      path: "src/bun/edem.ts",
      content: generateBunEdem(ir),
    })

    files.push({
      path: "src/bun/index.ts",
      content: generateBunIndex(ir),
    })

    files.push({
      path: "src/edem-bridge.ts",
      content: generateEdemBridge(),
    })

    files.push({
      path: "src/edem.ts",
      content: generateEdemProxy(ir),
    })

    // Copy Electrobun platform scripts
    const scriptsDir = join(import.meta.dir, "electrobun", "scripts")
    for (const file of readdirSync(scriptsDir)) {
      files.push({
        path: `scripts/${file}`,
        content: readFileSync(join(scriptsDir, file), "utf-8"),
      })
    }

    const deps = ["electrobun", "@exodus/edem-core"]

    if (ir.flows.length > 0) {
      deps.push("@exodus/edem-flows")
    }

    const hasElectrobunFlows = ir.flows.some((f) =>
      f.nodes.some((n) => n.data?.module === "electrobun"),
    )
    if (hasElectrobunFlows) {
      deps.push("@exodus/edem-electrobun")
    }

    return { files, deps }
  },
}

// ── Generators ────────────────────────────────────────────────────────────────

function generateElectrobunConfig(ir: IR): string {
  const name = capitalize(ir.project.name)
  const identifier = ir.project.identifier

  return `import type { ElectrobunConfig } from "electrobun"
import path from "path"
import { readFileSync } from "fs"

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"))

const aliasPlugin = {
  name: "alias-resolver",
  setup(build: any) {
    build.onResolve({ filter: /^@\\// }, (args: any) => {
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
    name: "${name}",
    identifier: "${identifier}",
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
`
}

function generateBunEdem(_ir: IR): string {
  const imports = [
    `import { Utils } from "electrobun/bun"`,
    `import { createEdem } from "@exodus/edem-core"`,
    `import { dataModule } from "@exodus/edem-data"`,
    `import { flowsModule } from "@exodus/edem-flows"`,
    `import { electrobunModule } from "@exodus/edem-electrobun/module"`,
  ]

  const moduleList = ["dataModule", "flowsModule", "electrobunModule"]

  return `${imports.join("\n")}

export const modules = [${moduleList.join(", ")}]
export const edem = createEdem(modules, { appData: Utils.paths.userData })
`
}

function generateBunIndex(ir: IR): string {
  const features = ir.platform.features
  const hasLogger = !!features.consoleLogger
  const hasWindowState = !!features.windowPersistence
  const hasSystemDetection = !!features.systemDetection
  const hasDevtools = !!features.devtools
  const hasWayland = features.waylandWorkaround

  const imports = [
    `import { BrowserWindow, BrowserView, Updater, ApplicationMenu } from "electrobun/bun"`,
    `import type { RPCSchema } from "electrobun"`,
    `import { createBunEdemBridge } from "@exodus/edem-electrobun/bun"`,
    `import type { EdemMsg } from "@exodus/edem-electrobun/types"`,
    `import { setElectrobunDeps } from "@exodus/edem-electrobun/module"`,
    `import { startScheduler, startDispatcher } from "@exodus/edem-flows"`,
    `import { edem, modules } from "@/bun/edem"`,
    `import { ensureCollections } from "@/manifest"`,
    `import { ensureFlows } from "@/flows-bootstrap"`,
  ]

  if (hasLogger) imports.push(`import { logger } from "@/platform/logger"`)
  if (hasWindowState) {
    imports.push(`import { onWindowFrameChange } from "@exodus/edem-electrobun/window"`)
  }
  if (hasWindowState || hasSystemDetection) {
    const appStateImports: string[] = []
    if (hasSystemDetection) appStateImports.push("initStateDefaults")
    if (hasWindowState) appStateImports.push("persistWindowFrame", "persistRoute", "persistSetting")
    if (appStateImports.length > 0) {
      imports.push(`import { ${appStateImports.join(", ")} } from "@/platform/app-state"`)
    }
  }

  const body: string[] = []

  // Wayland workaround
  if (hasWayland) {
    body.push(`// Workaround for WebKitGTK + NVIDIA + Wayland rendering issue.
if (process.platform === "linux") {
  const wayland = process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === "wayland"
  if (wayland && process.env.WEBKIT_DISABLE_DMABUF_RENDERER !== "1") {
    process.env.WEBKIT_DISABLE_DMABUF_RENDERER = "1"
    console.log("[linux] Wayland detected: WEBKIT_DISABLE_DMABUF_RENDERER=1")
  }
}
`)
  }

  body.push(`const DEV_SERVER_PORT = 5173
const DEV_SERVER_URL = \`http://localhost:\${DEV_SERVER_PORT}\`

async function getMainViewUrl(): Promise<string> {
  try {
    const channel = await Updater.localInfo.channel()
    if (channel === "dev") {
      try {
        await fetch(DEV_SERVER_URL, { method: "HEAD" })
        return DEV_SERVER_URL
      } catch {
        // dev server not running
      }
    }
  } catch {
    // updater fails outside bundled app
  }
  return "views://mainview/index.html"
}

const url = await getMainViewUrl()

const edemBridge = createBunEdemBridge(edem, modules)

const rpc = BrowserView.defineRPC<{
  bun: RPCSchema<{
    messages: { edem: EdemMsg }
  }>
  webview: RPCSchema<{
    messages: { edem: EdemMsg }
  }>
}>({
  handlers: {
    messages: {
      edem: (msg: EdemMsg) => {
        edemBridge.handler(msg)
      },
    },
  },
})

await ensureCollections(edem.data)
await ensureFlows(edem.flows)

setElectrobunDeps({ Updater })

await startScheduler(edem.flows, edem.data)
const flowsDispatcher = await startDispatcher(edem.flows, edem.data)

edemBridge.onWebviewEvent((name, payload) => {
  if (name === "app-state:route-changed") {
    persistRoute(edem.data, (payload as { hash?: string }).hash)
    return
  }
  if (name === "app-state:setting-changed") {
    const { key, value } = payload as { key?: string; value?: unknown }
    if (key) persistSetting(edem.data, key, value)
    return
  }
  flowsDispatcher.emit(name, payload)
})`)

  // System detection
  if (hasSystemDetection) {
    body.push(`
await initStateDefaults(edem.data)`)
  }

  // Window state restoration
  if (hasWindowState) {
    body.push(`
const defaultFrame = { width: 1200, height: 800, x: 0, y: 0 }
let savedFrame = defaultFrame
let savedMaximized = false
try {
  const { items } = await edem.data.queryItems({ collection_id: "${features.windowPersistence!.singleton}" })
  if (items.length > 0) {
    if (items[0].data.window_frame) {
      savedFrame = items[0].data.window_frame as typeof defaultFrame
    }
    savedMaximized = (items[0].data.window_maximized as boolean) ?? false
  }
} catch {
  // use defaults
}`)
  }

  body.push(`
const win = new BrowserWindow({
  title: "${capitalize(ir.project.name)}",
  url,
  titleBarStyle: "hiddenInset",${hasWindowState ? "\n  frame: savedFrame," : ""}
  rpc,
})

${
  hasWindowState
    ? `if (savedMaximized) {
  win.maximize()
}`
    : ""
}

const { webview } = win

edemBridge.attachWebview(webview)`)

  // App state init (window events)
  if (hasWindowState) {
    body.push(`
onWindowFrameChange(win, (f) => persistWindowFrame(edem.data, f.frame, f.maximized))`)
  }

  // Application menu
  const menuItems: string[] = []
  menuItems.push(`{
    label: "${capitalize(ir.project.name)}",
    submenu: [{ label: "Quit ${capitalize(ir.project.name)}", accelerator: "Cmd+Q", action: "quit" }],
  }`)
  menuItems.push(`{
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  }`)
  menuItems.push(`{
    label: "Window",
    submenu: [{ role: "minimize" }, { role: "close" }],
  }`)
  if (hasDevtools) {
    menuItems.push(`{
    label: "Developer",
    submenu: [
      {
        label: "Toggle DevTools",
        accelerator: "${features.devtools!.accelerator}",
        action: "toggle-devtools",
      },
    ],
  }`)
  }

  body.push(`
ApplicationMenu.setApplicationMenu([
  ${menuItems.join(",\n  ")},
])

ApplicationMenu.on("application-menu-clicked", (event) => {
  const menuEvent = event as { data?: { action?: string } }
  if (menuEvent.data?.action === "quit") {
    process.exit(0)
  }${
    hasDevtools
      ? `
  if (menuEvent.data?.action === "toggle-devtools") {
    webview.toggleDevTools()
  }`
      : ""
  }
})`)

  // Logger
  if (hasLogger) {
    body.push(`
logger.attach(edem.data)`)
  }

  body.push(`
console.log("Bun process started")

export { edem }
`)

  return `${imports.join("\n")}

${body.join("\n")}`
}

function generateEdemBridge(): string {
  return `import { Electroview } from "electrobun/view"
import type { RPCSchema } from "electrobun"
import { createWebviewEdemBridge } from "@exodus/edem-electrobun/webview"
import type { EdemMsg } from "@exodus/edem-electrobun/types"

const edemBridge = createWebviewEdemBridge()

const rpc = Electroview.defineRPC<{
  bun: RPCSchema<{
    messages: { edem: EdemMsg }
  }>
  webview: RPCSchema<{
    messages: { edem: EdemMsg }
  }>
}>({
  handlers: {
    messages: {
      edem: (msg: EdemMsg) => {
        edemBridge.handler(msg)
      },
    },
  },
})

edemBridge.attachBun(rpc.send.edem)

export { rpc, edemBridge }
`
}

function generateEdemProxy(_ir: IR): string {
  const imports = [
    `import { createEdemProxy, type InferModuleAPI } from "@exodus/edem-core"`,
    `import type { dataModule } from "@exodus/edem-data"`,
    `import type { flowsModule } from "@exodus/edem-flows"`,
    `import type { electrobunModule } from "@exodus/edem-electrobun/module"`,
    `import { edemBridge } from "@/edem-bridge"`,
  ]

  const typeEntries = [
    `  data: InferModuleAPI<typeof dataModule>`,
    `  flows: InferModuleAPI<typeof flowsModule>`,
    `  electrobun: InferModuleAPI<typeof electrobunModule>`,
  ]

  return `${imports.join("\n")}

type EdemAPI = {
${typeEntries.join("\n")}
}

export const edem = createEdemProxy<EdemAPI>(edemBridge.workerFactory)

export function useEdem() {
  return edem
}
`
}
