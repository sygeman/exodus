import type { RouteRecordRaw } from "vue-router"
import SettingsLayout from "./pages/SettingsLayout.vue"
import SettingsAppearance from "./pages/SettingsAppearance.vue"
import SettingsLanguage from "./pages/SettingsLanguage.vue"

export const settingsRoutes: RouteRecordRaw[] = [
  {
    path: "/settings",
    component: SettingsLayout,
    redirect: "/settings/appearance",
    children: [
      { path: "appearance", component: SettingsAppearance },
      { path: "language", component: SettingsLanguage },
    ],
  },
]
