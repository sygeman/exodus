import "./app.css"
import ui from "@nuxt/ui/vue-plugin"
import { createApp } from "vue"
import { createRouter, createWebHashHistory } from "vue-router"
import App from "./App.vue"
import CounterPage from "./pages/CounterPage.vue"
import { evento, rpc } from "./evento"
import { Electroview } from "electrobun/view"
import { webviewLogger } from "@/modules/logger/webview"

webviewLogger.init()

const electroview = new Electroview({ rpc })
evento.sender = (msg: { name: string; payload: unknown; meta: any }) => {
  ;(electroview.rpc as any).send.emit(msg)
}

const app = createApp(App)

const router = createRouter({
  routes: [{ path: "/", component: CounterPage }],
  history: createWebHashHistory(),
})

app.use(router)
app.use(ui)

app.mount("#app")

setTimeout(() => {
  const splash = document.getElementById("splash")
  if (splash) {
    splash.classList.add("fade-out")
    splash.addEventListener("transitionend", () => splash.remove(), { once: true })
  }
}, 1500)
