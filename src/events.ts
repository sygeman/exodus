import { counterRegistry } from "./modules/counter/events"
import { timerRegistry } from "./modules/timer/events"
import { loggerRegistry } from "./modules/logger/events"
import { updaterRegistry } from "./modules/updater/events"
import { schemaRegistry } from "./modules/schema/events"
import type { EventoRegistry } from "./lib/evento/types"
import type { CounterEventMap } from "./modules/counter/events"
import type { TimerEventMap } from "./modules/timer/events"
import type { LoggerEventMap } from "./modules/logger/events"
import type { UpdaterEventMap } from "./modules/updater/events"
import type { SchemaEventMap } from "./modules/schema/events"

export type GlobalEventMap = CounterEventMap & TimerEventMap & LoggerEventMap & UpdaterEventMap & SchemaEventMap

export const globalRegistry: EventoRegistry = {
  ...counterRegistry,
  ...timerRegistry,
  ...loggerRegistry,
  ...updaterRegistry,
  ...schemaRegistry,
}
