/**
 * Edem Flow Engine — visual workflow runtime, node execution, and triggers.
 *
 * Mock implementation for integration testing.
 */

import { type Evento, type Module, nextDepth } from "@exodus/edem-core"

export interface Flow {
  id: string
  name: string
  trigger: string
}

/**
 * Create the Flows module.
 *
 * Events:
 *   Commands:  flows:create_flow, flows:run_flow
 *   Facts:     flows:flow_created, flows:run_started, flows:run_completed
 *   Errors:    flows:error
 */
export function createFlowsModule(): Module {
  const flows = new Map<string, Flow>()

  return {
    name: "flows",
    init(evento: Evento) {
      // Create flow
      evento.handle("flows:create_flow", (ctx) => {
        const { name, trigger } = ctx.payload as { name: string; trigger: string }
        const id = crypto.randomUUID()
        const flow: Flow = { id, name, trigger }
        flows.set(id, flow)

        evento.emit("flows:flow_created", { flowId: id, name, trigger }, nextDepth(ctx.meta))

        return { flowId: id }
      })

      // Run flow
      evento.handle("flows:run_flow", async (ctx) => {
        const { flowId } = ctx.payload as { flowId: string }
        const flow = flows.get(flowId)
        if (!flow) throw new Error(`Flow ${flowId} not found`)

        const runId = crypto.randomUUID()

        // Emit: run started
        evento.emit("flows:run_started", { flowId, runId }, nextDepth(ctx.meta))

        // Flow creates data via data module (request-response)
        await evento.request(
          "data:create_item",
          { collectionId: "flows_output", data: { flowId, runId, result: "success" } },
          nextDepth(ctx.meta),
        )

        // Emit: run completed
        evento.emit(
          "flows:run_completed",
          { flowId, runId, status: "success" },
          nextDepth(ctx.meta),
        )

        return { runId, status: "success" }
      })
    },
  }
}
