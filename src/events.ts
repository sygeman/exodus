import { counterRegistry, type CounterEventMap } from "./modules/counter/events"
import { timerRegistry, type TimerEventMap } from "./modules/timer/events"
import { loggerRegistry, type LoggerEventMap } from "./modules/logger/events"
import { updaterRegistry, type UpdaterEventMap } from "./modules/updater/events"
import { schemaRegistry, type SchemaEventMap } from "./modules/schema/events"
import type { EventoRegistry } from "./lib/evento/types"

export type GlobalEventMap = CounterEventMap & TimerEventMap & LoggerEventMap & UpdaterEventMap & SchemaEventMap

export const globalRegistry: EventoRegistry = {
  ...counterRegistry,
  ...timerRegistry,
  ...loggerRegistry,
  ...updaterRegistry,
  ...schemaRegistry,
}
