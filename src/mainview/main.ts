import "./app.css"
import ui from "@nuxt/ui/vue-plugin"
import { createApp } from "vue"
import { createRouter, createWebHashHistory } from "vue-router"
import { createI18n } from "vue-i18n"
import App from "./App.vue"
import CounterPage from "./pages/CounterPage.vue"
import SettingsPage from "./pages/SettingsPage.vue"
import { evento, sender, rpc } from "./evento"
import { Electroview } from "electrobun/view"
import { webviewLogger } from "@/modules/logger/webview"
import { defaultLocale, messages } from "./locales"

webviewLogger.init()

new Electroview({ rpc })
evento.sender = sender

console.log("Webview process started")

window.addEventListener("error", (e) => {
  console.error("[webview error]", e.message, e.filename, e.lineno)
})

window.addEventListener("unhandledrejection", (e) => {
  console.error("[webview unhandledrejection]", e.reason)
})

const app = createApp(App)

const router = createRouter({
  routes: [
    { path: "/", component: CounterPage },
    { path: "/settings", component: SettingsPage },
  ],
  history: createWebHashHistory(),
})

const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: "en",
  messages,
})

app.use(router)
app.use(i18n)
app.use(ui)

app.mount("#app")

setTimeout(() => {
  const splash = document.getElementById("splash")
  if (splash) {
    splash.classList.add("fade-out")
    splash.addEventListener("transitionend", () => splash.remove(), { once: true })
  }
}, 1500)
