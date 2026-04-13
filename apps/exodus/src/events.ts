import type { CounterEventMap } from "./modules/counter/events"
import type { TimerEventMap } from "./modules/timer/events"

export type GlobalEventMap = CounterEventMap & TimerEventMap
