import { BrowserWindow, Updater } from "electrobun/bun"
import { createEventoBun } from "./evento"
import { initCounter } from "../modules/counter/bun"
import { initTimer } from "../modules/timer/bun"
import { globalRegistry } from "../events"

const DEV_SERVER_PORT = 5173
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`

async function getMainViewUrl(): Promise<string> {
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

initCounter(evento)
initTimer(evento)

evento.on("evento:schema:request", (ctx) => {
  const name = (ctx.payload as any).name
  console.log("[bun] schema:request for", name)
  const entry = evento.getSchema(name)
  const serialized = entry ? evento.serializeSchema(name) : null
  console.log("[bun] serialized:", serialized)
  evento.reply(ctx, {
    name,
    schema: serialized,
    description: entry?.description,
  })
})

export { evento }
