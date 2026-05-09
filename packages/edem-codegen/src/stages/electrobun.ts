import type { Stage, StageInput, StageOutput, OutputFile, IR } from "../ir"

// ── Electrobun Stage ──────────────────────────────────────────────────────────
// Generates Electrobun platform files: config, bridge, bun entry.

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
      content: generateBunEdem(),
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
      content: generateEdemProxy(),
    })

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
    watch: ["src/modules/**"],
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

function generateBunEdem(): string {
  return `import { Utils } from "electrobun/bun"
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "@exodus/edem-data"
import { flowsModule } from "@exodus/edem-flows"
import { electrobunModule } from "@exodus/edem-electrobun/module"

export const modules = [dataModule, flowsModule, electrobunModule]
export const edem = createEdem(modules, { appData: Utils.paths.userData })
`
}

function generateBunIndex(ir: IR): string {
  return `import { BrowserWindow, BrowserView, Updater, ApplicationMenu } from "electrobun/bun"
import type { RPCSchema } from "electrobun"
import { createBunEdemBridge } from "@exodus/edem-electrobun/bun"
import type { EdemMsg } from "@exodus/edem-electrobun/types"
import { setElectrobunDeps } from "@exodus/edem-electrobun/module"
import { startScheduler, startDispatcher } from "@exodus/edem-flows"
import { edem, modules } from "@/bun/edem"
import { ensureCollections } from "@/manifest"
import { ensureFlows } from "@/flows-bootstrap"

const DEV_SERVER_PORT = 5173
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
  flowsDispatcher.emit(name, payload)
})

const defaultFrame = { width: 1200, height: 800, x: 0, y: 0 }
let savedFrame = defaultFrame
let savedMaximized = false
try {
  const { items } = await edem.data.queryItems({ collection_id: "app_state" })
  if (items.length > 0) {
    if (items[0].data.window_frame) {
      savedFrame = items[0].data.window_frame as typeof defaultFrame
    }
    savedMaximized = (items[0].data.window_maximized as boolean) ?? false
  }
} catch {
  // use defaults
}

const win = new BrowserWindow({
  title: "${capitalize(ir.project.name)}",
  url,
  titleBarStyle: "hiddenInset",
  frame: savedFrame,
  rpc,
})

if (savedMaximized) {
  win.maximize()
}

const { webview } = win

edemBridge.attachWebview(webview)

ApplicationMenu.setApplicationMenu([
  {
    label: "App",
    submenu: [{ label: "Quit", accelerator: "Cmd+Q", action: "quit" }],
  },
  {
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
  },
])

ApplicationMenu.on("application-menu-clicked", (event) => {
  const menuEvent = event as { data?: { action?: string } }
  if (menuEvent.data?.action === "quit") {
    process.exit(0)
  }
})

console.log("Bun process started")

export { edem }
`
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

function generateEdemProxy(): string {
  return `import { createEdemProxy, type InferModuleAPI } from "@exodus/edem-core"
import type { dataModule } from "@exodus/edem-data"
import type { flowsModule } from "@exodus/edem-flows"
import { edemBridge } from "@/edem-bridge"

type EdemAPI = {
  data: InferModuleAPI<typeof dataModule>
  flows: InferModuleAPI<typeof flowsModule>
}

export const edem = createEdemProxy<EdemAPI>(edemBridge.workerFactory)

export function useEdem() {
  return edem
}
`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
