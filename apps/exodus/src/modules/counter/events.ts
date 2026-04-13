export type CounterEventMap = {
  "counter:increment": void
  "counter:reset": void
  "counter:updated": { count: number }
}

export const counterOutgoingEvents = ["counter:updated"] as const
