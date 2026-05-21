import { BrowserWindow, BrowserView, Updater, ApplicationMenu } from "electrobun/bun"
import type { RPCSchema } from "electrobun"
import { createBunEdemBridge, subscribeBunModuleEvents } from "@exodus/edem-electrobun/bun"
import type { EdemMsg } from "@exodus/edem-electrobun/types"
import { setElectrobunDeps } from "@exodus/edem-electrobun/module"
import { startScheduler, startDispatcher } from "@exodus/edem-flows"
import { edem, modules } from "@/bun/edem"
import { ensureCollections } from "@/manifest"
import { ensureFlows } from "@/flows-bootstrap"

const DEV_SERVER_PORT = 5173
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`

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

function toFlowTriggerPayload(event: unknown): Record<string, unknown> {
  return typeof event === "object" && event !== null && !Array.isArray(event)
    ? (event as Record<string, unknown>)
    : { value: event }
}

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

subscribeBunModuleEvents(edem, modules, ({ module, name, event }) => {
  flowsDispatcher.emit(`${module}.${name}`, toFlowTriggerPayload(event))
})

edemBridge.onWebviewEvent((name, payload) => {
  flowsDispatcher.emit(name, payload)
})

const win = new BrowserWindow({
  title: "Exodus",
  url,
  titleBarStyle: "hiddenInset",
  rpc,
})

const { webview } = win

edemBridge.attachWebview(webview)

ApplicationMenu.setApplicationMenu([
  {
    label: "Exodus",
    submenu: [{ label: "Quit Exodus", accelerator: "Cmd+Q", action: "quit" }],
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
  {
    label: "Window",
    submenu: [{ role: "minimize" }, { role: "close" }],
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
