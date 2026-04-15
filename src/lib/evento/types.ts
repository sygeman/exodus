export type EventMeta = {
  source: string
  depth: number
  trace_id: string
  timestamp: number
}

export type EventoMeta<E extends string = string> = EventMeta & {
  environment: E
}

// Extended handler with segments
export type EventoHandlerContext<E extends string = string, P = unknown> = {
  name: string
  payload: P
  meta: EventoMeta<E>
  segments: string[]
}

export type EventoHandler<E extends string = string, P = unknown> = (
  context: EventoHandlerContext<E, P>,
) => void

export type EventoUnsubscribe = () => void

export type EventoRegistryEntry = {
  schema: import("zod").ZodTypeAny
  response?: import("zod").ZodTypeAny
}

export type EventoRegistry = Record<string, EventoRegistryEntry>
