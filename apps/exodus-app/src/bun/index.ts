import { BrowserWindow, BrowserView, Updater, ApplicationMenu } from "electrobun/bun"
import type { RPCSchema } from "electrobun"
import { createBunEdemBridge } from "@exodus/edem-electrobun/bun"
import type { EdemMsg } from "@exodus/edem-electrobun/types"
import { setElectrobunDeps } from "@exodus/edem-electrobun/module"
import { startScheduler, startDispatcher } from "@exodus/edem-flows"
import { edem, modules } from "@/bun/edem"
import { ensureCollections } from "@/manifest"
import { ensureFlows } from "@/flows-bootstrap"
import { logger } from "@/platform/logger"
import { initAppState, initStateDefaults } from "@/platform/app-state"

// Workaround for WebKitGTK + NVIDIA + Wayland rendering issue.
if (process.platform === "linux") {
  const wayland = process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === "wayland"
  if (wayland && process.env.WEBKIT_DISABLE_DMABUF_RENDERER !== "1") {
    process.env.WEBKIT_DISABLE_DMABUF_RENDERER = "1"
    console.log("[linux] Wayland detected: WEBKIT_DISABLE_DMABUF_RENDERER=1")
  }
}

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

await initStateDefaults(edem.data)

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
  title: "Exodus",
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

initAppState(win, flowsDispatcher.emit)

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
  {
    label: "Developer",
    submenu: [
      {
        label: "Toggle DevTools",
        accelerator: "Cmd+Option+I",
        action: "toggle-devtools",
      },
    ],
  },
])

ApplicationMenu.on("application-menu-clicked", (event) => {
  const menuEvent = event as { data?: { action?: string } }
  if (menuEvent.data?.action === "quit") {
    process.exit(0)
  }
  if (menuEvent.data?.action === "toggle-devtools") {
    webview.toggleDevTools()
  }
})

logger.attach(edem.data)

console.log("Bun process started")

export { edem }
