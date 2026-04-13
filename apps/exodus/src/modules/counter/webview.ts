import { ref } from "vue"
import { evento } from "../../mainview/evento"

export function useCounter() {
  const count = ref(0)
  const autoIncrement = ref(false)

  evento.on("counter:updated", ({ payload }) => {
    count.value = payload.count
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

  return { count, autoIncrement, increment, reset, setAuto }
}
