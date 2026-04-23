/**
 * Edem Flow Engine — visual workflow runtime, node execution, and triggers.
 *
 * Mock implementation for integration testing.
 */

import { type Edem } from "@exodus/edem-core"

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
export function createFlowsModule(edem: Edem) {
  const flows = new Map<string, Flow>()

  // Create flow
  edem.handle("flows:create_flow", (ctx) => {
    const { name, trigger } = ctx.payload as { name: string; trigger: string }
    const id = crypto.randomUUID()
    const flow: Flow = { id, name, trigger }
    flows.set(id, flow)

    edem.emit("flows:flow_created", { flowId: id, name, trigger })

    return { flowId: id }
  })

  // Run flow
  edem.handle("flows:run_flow", async (ctx) => {
    const { flowId } = ctx.payload as { flowId: string }
    const flow = flows.get(flowId)
    if (!flow) throw new Error(`Flow ${flowId} not found`)

    const runId = crypto.randomUUID()

    // Emit: run started
    edem.emit("flows:run_started", { flowId, runId })

    // Flow creates data via data module (request-response)
    await edem.request("data:create_item", {
      collectionId: "flows_output",
      data: { flowId, runId, result: "success" },
    })

    // Emit: run completed
    edem.emit("flows:run_completed", { flowId, runId, status: "success" })

    return { runId, status: "success" }
  })

  // === Public API ===
  edem.flows = {
    createFlow: (params: { name: string; trigger: string }) =>
      edem.request("flows:create_flow", params),
    runFlow: (flowId: string) => edem.request("flows:run_flow", { flowId }),
  }
}
