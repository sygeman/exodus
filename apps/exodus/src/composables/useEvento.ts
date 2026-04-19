import { onUnmounted } from "vue"
import { evento } from "@/evento"
import type { GlobalEventMap } from "@/events"

export function useEvento() {
  const unsubs: (() => void)[] = []

  onUnmounted(() => {
    unsubs.forEach((u) => u())
  })

  return {
    on: <K extends keyof GlobalEventMap>(
      name: K,
      handler: (ctx: { payload: GlobalEventMap[K] }) => void,
    ) => {
      unsubs.push(evento.on(name, handler as Parameters<typeof evento.on>[1]))
    },
    once: <K extends keyof GlobalEventMap>(
      name: K,
      handler: (ctx: { payload: GlobalEventMap[K] }) => void,
    ) => {
      unsubs.push(evento.once(name, handler as Parameters<typeof evento.once>[1]))
    },
  }
}
