import type { Evento } from "@exodus/evento"
import type { GlobalEventMap } from "@/events"

export type EventoBun = Evento<"bun", ["webview"], GlobalEventMap>
