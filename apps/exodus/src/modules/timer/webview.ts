import { ref } from "vue"
import { evento } from "../../mainview/evento"

export function useTimer() {
  const time = ref(0)

  evento.on("timer:tick", ({ payload }) => {
    time.value = payload.time
  })

  return { time }
}
