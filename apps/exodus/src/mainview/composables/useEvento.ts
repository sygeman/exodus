import { onUnmounted } from "vue"
import { evento } from "../evento"

export function useEvento() {
  const unsubs: (() => void)[] = []

  onUnmounted(() => {
    unsubs.forEach((u) => u())
  })

  return {
    on: (name: string, handler: any) => {
      unsubs.push(evento.on(name, handler))
    },
    once: (name: string, handler: any) => {
      unsubs.push(evento.once(name, handler))
    },
  }
}
