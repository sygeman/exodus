import type { FlowContext } from "./context"

export type ActionHandler = (
  input: Record<string, unknown>,
  context: FlowContext,
) => Promise<Record<string, unknown>>

const registry = new Map<string, ActionHandler>()

export function registerAction(name: string, handler: ActionHandler): void {
  registry.set(name, handler)
}

export function getActionHandler(name: string): ActionHandler | undefined {
  return registry.get(name)
}
