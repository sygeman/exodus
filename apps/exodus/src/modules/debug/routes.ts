import type { RouteRecordRaw } from "vue-router"
import DebugLayout from "./pages/DebugLayout.vue"
import DebugLogs from "./pages/DebugLogs.vue"
import DebugState from "./pages/DebugState.vue"

export const debugRoutes: RouteRecordRaw[] = [
  {
    path: "/debug",
    component: DebugLayout,
    redirect: "/debug/logs",
    children: [
      { path: "logs", component: DebugLogs },
      { path: "state", component: DebugState },
    ],
  },
]
