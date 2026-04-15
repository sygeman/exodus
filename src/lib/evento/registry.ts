import type { EventoRegistryEntry } from "./types"

export function createRegistry<
  const N extends string,
  const T extends Record<string, EventoRegistryEntry>,
>(namespace: N, events: T): { [K in keyof T as `${N}:${K & string}`]: T[K] } {
  const result = {} as Record<string, EventoRegistryEntry>
  for (const [key, value] of Object.entries(events)) {
    result[`${namespace}:${key}`] = value
  }
  return result as { [K in keyof T as `${N}:${K & string}`]: T[K] }
}
