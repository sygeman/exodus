import { BrowserWindow, Updater, ApplicationMenu } from "electrobun/bun"
import { createEventoBun } from "@/bun/evento"
import { initUpdater } from "@/modules/updater/bun"
import { initSchema } from "@/modules/schema/bun"
import { initProjects } from "@/modules/projects/bun"
import { bunLogger } from "@/modules/logger/bun"
import { initAppState } from "@/modules/app-state/bun"
import { globalRegistry } from "@/events"

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

const { evento, rpc } = createEventoBun()

evento.register(globalRegistry)

const { webview } = new BrowserWindow({
  title: "Exodus",
  url,
  frame: { width: 1200, height: 800, x: 0, y: 0 },
  rpc,
})

evento.sender = webview.rpc?.send?.emit

initAppState(evento, (name, payload) => {
  evento.emitEvent(name, payload, "app:init")
})

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

bunLogger.attach(evento)
initProjects(evento)
initUpdater(evento)
initSchema(evento)

console.log("Bun process started")

export { evento }
