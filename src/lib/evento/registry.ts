import type { EventoRegistryEntry } from "./types"

export function createRegistry<
  const N extends string,
  const T extends Record<string, EventoRegistryEntry>,
>(namespace: N, events: T): { [K in keyof T as `${N}:${K & string}`]: T[K] } {
  const result = {} as Record<string, EventoRegistryEntry>
  for (const [key, value] of Object.entries(events)) {
    const fullKey = `${namespace}:${key}`
    result[fullKey] = value
    if (value.response) {
      result[`${fullKey}:response`] = { schema: value.response }
    }
  }
  return result as { [K in keyof T as `${N}:${K & string}`]: T[K] }
}
