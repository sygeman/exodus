import { schemaRegistry, type SchemaEventMap } from "./modules/schema/events"
import type { EventoRegistry } from "@exodus/evento"

export type GlobalEventMap = SchemaEventMap

export const globalRegistry: EventoRegistry = {
  ...schemaRegistry,
}
