import { createEdemModule } from "@exodus/edem-core"
import { z } from "zod"
import { setEdemModules } from "./executors"

type Handler = (input: Record<string, unknown>) => Promise<Record<string, unknown>>

const handlers = new Map<string, Handler>()
const handlerSchema = z.record(z.string(), z.unknown())

function buildMutation(name: string) {
  return {
    input: handlerSchema,
    output: handlerSchema,
    resolve: async ({ input }: { input: Record<string, unknown> }) => {
      const handler = handlers.get(name)
      if (!handler) {
        throw new Error(`Test handler "${name}" not registered`)
      }
      return handler(input)
    },
  }
}

export const testModule = createEdemModule("test", (module) =>
  module
    .context(async () => ({}))
    .mutation("test", buildMutation("test"))
    .mutation("send_email", buildMutation("send_email"))
    .mutation("resume_test_action", buildMutation("resume_test_action"))
    .mutation("approve", buildMutation("approve"))
    .mutation("wait", buildMutation("wait"))
    .mutation("risky", buildMutation("risky"))
    .mutation("slow_action", buildMutation("slow_action"))
    .mutation("pending_action", buildMutation("pending_action"))
    .mutation("auto_process", buildMutation("auto_process"))
    .mutation("flaky_action", buildMutation("flaky_action"))
    .mutation("always_fail", buildMutation("always_fail"))
    .mutation("fail_after_retry", buildMutation("fail_after_retry"))
    .mutation("e2e_resume_action", buildMutation("e2e_resume_action"))
    .mutation("e2e_wrong_node_action", buildMutation("e2e_wrong_node_action"))
    .mutation("e2e_fail_action", buildMutation("e2e_fail_action"))
    .mutation("e2e_cancel_action", buildMutation("e2e_cancel_action"))
    .mutation("e2e_transitions_action", buildMutation("e2e_transitions_action"))
    .mutation("e2e_sync_action", buildMutation("e2e_sync_action"))
    .mutation("e2e_later_action", buildMutation("e2e_later_action"))
    .mutation("e2e_loop_action", buildMutation("e2e_loop_action"))
    .mutation("e2e_fork_action_a", buildMutation("e2e_fork_action_a"))
    .mutation("e2e_fork_action_b", buildMutation("e2e_fork_action_b"))
    .mutation("e2e_auto_loop", buildMutation("e2e_auto_loop"))
    .mutation("e2e_fork_err_action_a", buildMutation("e2e_fork_err_action_a"))
    .mutation("e2e_fork_err_action_b", buildMutation("e2e_fork_err_action_b"))
    .mutation("e2e_subflow_async_action", buildMutation("e2e_subflow_async_action"))
    .mutation("e2e_bp_action", buildMutation("e2e_bp_action"))
    .mutation("e2e_bp_pending_action", buildMutation("e2e_bp_pending_action"))
    .mutation("e2e_bp_update_action", buildMutation("e2e_bp_update_action"))
    .mutation("e2e_bp_change_action", buildMutation("e2e_bp_change_action"))
    .mutation("e2e_bp_concurrent_action", buildMutation("e2e_bp_concurrent_action"))
    .mutation("e2e_bp_error_action", buildMutation("e2e_bp_error_action"))
    .mutation("e2e_flaky", buildMutation("e2e_flaky")),
)

function buildModule(): Record<string, (input: unknown) => Promise<unknown>> {
  const mod: Record<string, (input: unknown) => Promise<unknown>> = {}
  for (const [name, handler] of handlers) {
    mod[name] = async (input: unknown) => handler(input as Record<string, unknown>)
  }
  return mod
}

/**
 * Register a test module procedure. Use { module: "test", procedure: name } in flow nodes.
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
