import { ref } from "vue"
import { useEvento } from "@/mainview/composables/useEvento"

export function useTimer() {
  const { on } = useEvento()
  const time = ref(0)

  on("timer:tick", ({ payload }) => {
    time.value = payload.time
  })

  return { time }
}
