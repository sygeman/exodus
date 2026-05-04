import { loggerRegistry, type LoggerEventMap } from "./modules/logger/events"
import { updaterRegistry, type UpdaterEventMap } from "./modules/updater/events"
import { schemaRegistry, type SchemaEventMap } from "./modules/schema/events"
import { appStateRegistry, type AppStateEventMap } from "./modules/app-state/events"
import type { EventoRegistry } from "@exodus/evento"

export type GlobalEventMap = LoggerEventMap & UpdaterEventMap & SchemaEventMap & AppStateEventMap

export const globalRegistry: EventoRegistry = {
  ...loggerRegistry,
  ...updaterRegistry,
  ...schemaRegistry,
  ...appStateRegistry,
}
