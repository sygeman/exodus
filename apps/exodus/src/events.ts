import { updaterRegistry, type UpdaterEventMap } from "./modules/updater/events"
import { schemaRegistry, type SchemaEventMap } from "./modules/schema/events"
import type { EventoRegistry } from "@exodus/evento"

export type GlobalEventMap = UpdaterEventMap & SchemaEventMap

export const globalRegistry: EventoRegistry = {
  ...updaterRegistry,
  ...schemaRegistry,
}
