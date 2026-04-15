import "./app.css"
import ui from "@nuxt/ui/vue-plugin"
import { createApp, watch } from "vue"
import { createRouter, createWebHashHistory } from "vue-router"
import { createI18n } from "vue-i18n"
import { useColorMode } from "@vueuse/core"
import App from "./App.vue"
import CounterPage from "./pages/CounterPage.vue"
import EventsPage from "./pages/EventsPage.vue"
import LogsPage from "./pages/LogsPage.vue"
import SettingsLayout from "./pages/settings/SettingsLayout.vue"
import SettingsAppearance from "./pages/settings/SettingsAppearance.vue"
import SettingsLanguage from "./pages/settings/SettingsLanguage.vue"
import SettingsAbout from "./pages/settings/SettingsAbout.vue"
import { evento, rpc } from "./evento"
import { Electroview } from "electrobun/view"
import { webviewLogger } from "@/modules/logger/webview"
import { defaultLocale, messages, resolveLocale } from "./locales"
import { useAppState } from "./composables/useAppState"

webviewLogger.init()

const electroview = new Electroview({ rpc })
evento.sender = (msg) => electroview.rpc?.send?.emit(msg)

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
    { path: "/events", component: EventsPage },
    { path: "/logs", component: LogsPage },
    {
      path: "/settings",
      component: SettingsLayout,
      redirect: "/settings/appearance",
      children: [
        { path: "appearance", component: SettingsAppearance },
        { path: "language", component: SettingsLanguage },
        { path: "about", component: SettingsAbout },
      ],
    },
  ],
  history: createWebHashHistory(),
})

const { startWatching, systemLocale, systemTheme } = useAppState(router)
startWatching()

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

// Apply preferences once received from bun
const unwatchLocale = watch(systemLocale, (value) => {
  if (value) {
    i18n.global.locale.value = resolveLocale(value)
    unwatchLocale()
  }
})

const unwatchTheme = watch(systemTheme, (value) => {
  if (value) {
    const colorMode = useColorMode()
    colorMode.store.value = value
    unwatchTheme()
  }
})

setTimeout(() => {
  const splash = document.getElementById("splash")
  if (splash) {
    splash.classList.add("fade-out")
    splash.addEventListener("transitionend", () => splash.remove(), {
      once: true,
    })
  }
}, 1500)
