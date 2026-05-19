import { defineComponent, h } from "vue"
import { useRoute, useRouter } from "vue-router"
import { edem } from "@/edem"
import { runtimeScreens } from "./screens"
import { useScreenRuntime } from "./useScreenRuntime"

export default defineComponent({
  name: "RuntimeScreenHost",
  setup() {
    const route = useRoute()
    const router = useRouter()

    const screenId = route.meta.screenId
    const entry = typeof screenId === "string" ? runtimeScreens[screenId] : undefined

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
      },
    })

    return () => {
      return runtime.renderRoot()
    }
  },
})
