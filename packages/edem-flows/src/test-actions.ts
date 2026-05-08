import { setEdemModules } from "./executors"

type Handler = (input: Record<string, unknown>) => Promise<Record<string, unknown>>

const handlers = new Map<string, Handler>()

function buildModule(): Record<string, (input: unknown) => Promise<unknown>> {
  const mod: Record<string, (input: unknown) => Promise<unknown>> = {}
  for (const [name, handler] of handlers) {
    mod[name] = async (input: unknown) => handler(input as Record<string, unknown>)
  }
  return mod
}

/**
 * Register a test action. Use { module: "test", proc: name } in flow nodes.
 */
export function reg(name: string, handler: Handler): void {
  handlers.set(name, handler)
  setEdemModules({ test: buildModule() })
}

/**
 * Clear all test actions.
 */
export function clear(): void {
  handlers.clear()
  setEdemModules({})
}
