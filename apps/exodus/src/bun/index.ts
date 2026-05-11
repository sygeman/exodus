import { BrowserWindow, BrowserView, Updater, ApplicationMenu } from "electrobun/bun"
import type { RPCSchema } from "electrobun"
import { createBunEdemBridge } from "@exodus/edem-electrobun/bun"
import type { EdemMsg } from "@exodus/edem-electrobun/types"
import { setElectrobunDeps } from "@exodus/edem-electrobun/module"
import { startScheduler, startDispatcher } from "@exodus/edem-flows"
import { edem, modules } from "@/bun/edem"
import { ensureCollections } from "@/manifest"
import { ensureFlows } from "@/flows-bootstrap"
import { bunLogger } from "@exodus/edem-electrobun/logger-bun"
import { initStateDefaults, persistWindowFrame } from "@/platform/app-state"
import { onWindowFrameChange } from "@exodus/edem-electrobun/window"

// Workaround for WebKitGTK + NVIDIA + Wayland rendering issue.
// The DMA-BUF renderer fails to create GBM buffers on NVIDIA in Wayland
// sessions, resulting in a blank webview. Disabling it forces the fallback
// to the shared-memory renderer which works correctly.
// See: https://bugs.webkit.org/show_bug.cgi?id=261874
//
// NOTE: In production builds the launcher (main.js) sets this env var before
// starting the GTK event loop, so this block is primarily a fallback for
// dev mode where the app is run directly without the launcher.
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
        console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`)
        return DEV_SERVER_URL
      } catch {
        console.log("Vite dev server not running. Run 'bun run dev:hmr' for HMR support.")
      }
    }
  } catch {
    // Updater fails outside bundled app (dev mode)
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

// Set up Electrobun dependencies for the electrobun module
setElectrobunDeps({ Updater })

await startScheduler(edem.flows, edem.data)
const flowsDispatcher = await startDispatcher(edem.flows, edem.data)

edemBridge.onWebviewEvent((name, payload) => {
  flowsDispatcher.emit(name, payload)
})

await initStateDefaults()

const defaultFrame = { width: 1200, height: 800, x: 0, y: 0 }
let savedFrame = defaultFrame
let savedMaximized = false
try {
  const { item } = await edem.data.getSingleton({ collection_id: "app_state" })
  if (item) {
    if (item.data.window_frame) {
      savedFrame = item.data.window_frame as typeof defaultFrame
    }
    savedMaximized = (item.data.window_maximized as boolean) ?? false
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

onWindowFrameChange(win, (f) => persistWindowFrame(f.frame, f.maximized ?? false))

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

bunLogger.attach((entry) => {
  edem.data.createItem({ collection_id: "logs", data: entry }).catch(() => {})
})

console.log("Bun process started")

export { edem }
