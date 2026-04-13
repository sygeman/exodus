import { ref } from "vue"
import { evento } from "@/mainview/evento"
import { useEvento } from "@/mainview/composables/useEvento"

export function useCounter() {
  const { on } = useEvento()
  const count = ref(0)
  const autoIncrement = ref(false)
  const loading = ref(true)

  on("counter:updated", ({ payload }: any) => {
    count.value = payload.count
    autoIncrement.value = payload.autoIncrement
    loading.value = false
  })

  evento.request("counter:query", {}, { timeout: 2000 })
    .then((res) => {
      const data = res.data as { count: number; autoIncrement: boolean }
      count.value = data.count
      autoIncrement.value = data.autoIncrement
    })
    .catch((err) => {
      console.error("[counter] query failed:", err)
    })
    .finally(() => {
      loading.value = false
    })

  const increment = () => {
    evento.emitEvent("counter:increment", "user:click_btn_increment")
  }

  const reset = () => {
    evento.emitEvent("counter:reset", "user:click_btn_reset")
  }

  const setAuto = (value: boolean) => {
    autoIncrement.value = value
    if (value) {
      evento.emitEvent("counter:auto:enable", "user:toggle_auto")
    } else {
      evento.emitEvent("counter:auto:disable", "user:toggle_auto")
    }
  }

  return { count, autoIncrement, loading, increment, reset, setAuto }
}
