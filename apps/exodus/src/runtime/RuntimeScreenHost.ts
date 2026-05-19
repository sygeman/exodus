import { defineComponent, h } from "vue"
import { useRoute, useRouter } from "vue-router"
import { edem } from "@/edem"
import { getRuntimeScreenEntry } from "./screens"
import { useScreenRuntime } from "./useScreenRuntime"

function getInitials(value: unknown): string {
  if (typeof value !== "string") {
    return ""
  }

  return value.slice(0, 2).toUpperCase()
}

export default defineComponent({
  name: "RuntimeScreenHost",
  setup() {
    const route = useRoute()
    const router = useRouter()

    const screenId = route.meta.screenId
    const entry = typeof screenId === "string" ? getRuntimeScreenEntry(screenId) : undefined

    if (!entry) {
      return () => h("div", { class: "p-4 text-sm text-red-500" }, "Runtime screen not found")
    }

    const runtime = useScreenRuntime({
      screen: entry.screen,
      flows: entry.flows,
      registry: {},
      context: {
        route,
        router,
        edem,
        helpers: {
          getInitials,
        },
      },
    })

    return () => {
      return runtime.renderRoot()
    }
  },
})
