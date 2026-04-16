import "./app.css"
import ui from "@nuxt/ui/vue-plugin"
import { createApp, watch } from "vue"
import { createRouter, createWebHashHistory } from "vue-router"
import { createI18n } from "vue-i18n"
import { useColorMode } from "@vueuse/core"
import App from "./App.vue"
import ProjectsListPage from "@/modules/projects/components/ProjectsListPage.vue"
import ProjectLayout from "@/modules/projects/components/ProjectLayout.vue"
import ProjectPage from "@/modules/projects/components/ProjectPage.vue"
import ProjectSettingsPage from "@/modules/projects/components/ProjectSettingsPage.vue"
import { debugRoutes } from "@/modules/debug/routes"
import { settingsRoutes } from "@/modules/settings/routes"
import NotFound from "./pages/NotFound.vue"
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
    { path: "/", redirect: "/projects" },
    { path: "/projects", component: ProjectsListPage },
    {
      path: "/project/:id",
      component: ProjectLayout,
      redirect: (to) => `/project/${to.params.id}/board`,
      children: [
        { path: "board", component: ProjectPage },
        { path: "settings", component: ProjectSettingsPage },
      ],
    },
    ...debugRoutes,
    ...settingsRoutes,
    { path: "/:pathMatch(.*)*", component: NotFound },
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
