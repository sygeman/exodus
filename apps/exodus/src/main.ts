import "./app.css"
import ui from "@nuxt/ui/vue-plugin"
import { createApp, watch } from "vue"
import { createI18n } from "vue-i18n"
import { useColorMode } from "@vueuse/core"
import App from "./App.vue"
import router from "./router"
import { rpc } from "./edem-bridge"
import { Electroview } from "electrobun/view"
import { initLogs } from "@exodus/edem-electrobun/logger-webview"
import { edem } from "@/edem"
import { defaultLocale, resolveLocale } from "./locales"
import { useAppState } from "./composables/useAppState"

initLogs((entry) => {
  edem.data.createItem({ collection_id: "logs", data: entry }).catch(() => {})
})

void new Electroview({ rpc })

console.log("Webview process started")

const app = createApp(App)

const { startWatching, systemLocale, systemTheme } = useAppState(router)
startWatching()

const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: "en",
  messages: { en: {}, ru: {} },
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
