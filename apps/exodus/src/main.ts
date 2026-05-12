import "./app.css"
import ui from "@nuxt/ui/vue-plugin"
import { createApp } from "vue"
import { createI18n } from "vue-i18n"
import App from "./App.vue"
import router from "./router"
import { rpc } from "./edem-bridge"
import { Electroview } from "electrobun/view"
import { initLogs } from "@exodus/edem-electrobun/logger-webview"
import { edem } from "@/edem"
import { defaultLocale, resolveLocale } from "./locales"
import { persistRoute } from "./utils/persist-route"
import { applyTheme } from "./utils/apply-theme"

initLogs((entry) => {
  edem.data.createItem({ collection_id: "logs", data: entry }).catch(() => {})
})

void new Electroview({ rpc })

console.log("Webview process started")

const app = createApp(App)

persistRoute({
  router,
  getRoute: async () => {
    const appState = await edem.data.getSingleton({ collection_id: "app_state" })
    return appState.item?.data.last_route?.hash ?? null
  },
  setRoute: async (hash) => {
    await edem.data.updateSingleton({ collection_id: "app_state", data: { last_route: { hash } } })
  },
})

const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: "en",
  messages: { en: {}, ru: {} },
})

edem.data.itemUpdated(async ({ event: item }) => {
  if (item.collection_id !== "app_state") return
  i18n.global.locale.value = resolveLocale(item.data.locale)
  applyTheme(!!item.data.dark)
})

app.use(router)
app.use(i18n)
app.use(ui)
app.mount("#app")

setTimeout(() => {
  const splash = document.getElementById("splash")
  if (splash) {
    splash.classList.add("fade-out")
    splash.addEventListener("transitionend", () => splash.remove(), {
      once: true,
    })
  }
}, 1500)
