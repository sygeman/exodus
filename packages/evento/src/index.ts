export { Evento, type EventoMetaType, MAX_EVENT_DEPTH, DEPTH_WARNING_THRESHOLD } from "./evento"
export { createRegistry } from "./registry"
export { isWildcard, splitSegments, matchPattern } from "./utils"
export type {
  EventMeta,
  EventoMeta,
  EventoHandlerContext,
  EventoHandler,
  EventoUnsubscribe,
  EventoRegistryEntry,
  EventoRegistry,
} from "./types"
