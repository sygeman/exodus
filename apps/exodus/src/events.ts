import type { EventoRegistry } from "@exodus/evento"

export type GlobalEventMap = Record<string, unknown>

export const globalRegistry: EventoRegistry = {}
