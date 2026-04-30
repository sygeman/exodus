import { z } from "zod"
import { createEdemModule } from "@exodus/edem-core"

export const flowSchema = z.object({
  id: z.string(),
  name: z.string(),
  trigger: z.string(),
})

export const flowsModule = createEdemModule("flows", (module) => {
  return module
    .context(async () => ({
      flows: new Map<string, z.infer<typeof flowSchema>>(),
    }))
    .subscription("flowCreated", {
      output: z.object({
        flow_id: z.string(),
        name: z.string(),
        trigger: z.string(),
      }),
    })
    .subscription("runStarted", {
      output: z.object({
        flow_id: z.string(),
        run_id: z.string(),
      }),
    })
    .subscription("runCompleted", {
      output: z.object({
        flow_id: z.string(),
        run_id: z.string(),
        status: z.string(),
      }),
    })
    .mutation("createFlow", {
      input: z.object({
        name: z.string(),
        trigger: z.string(),
      }),
      output: z.object({
        flow_id: z.string(),
      }),
      resolve: async ({ input, ctx, emit }) => {
        const id = crypto.randomUUID()
        const flow = { id, name: input.name, trigger: input.trigger }
        ctx.flows.set(id, flow)
        await emit.flowCreated({ flow_id: id, name: input.name, trigger: input.trigger })
        return { flow_id: id }
      },
    })
    .mutation("runFlow", {
      input: z.object({
        flow_id: z.string(),
      }),
      output: z.object({
        run_id: z.string(),
        status: z.string(),
      }),
      resolve: async ({ input, ctx, emit }) => {
        const flow = ctx.flows.get(input.flow_id)
        if (!flow) throw new Error(`Flow ${input.flow_id} not found`)

        const runId = crypto.randomUUID()
        await emit.runStarted({ flow_id: input.flow_id, run_id: runId })
        await emit.runCompleted({ flow_id: input.flow_id, run_id: runId, status: "success" })

        return { run_id: runId, status: "success" }
      },
    })
    .query("getFlow", {
      input: z.object({
        flow_id: z.string(),
      }),
      output: z.object({
        flow: flowSchema.nullable(),
      }),
      resolve: async ({ input, ctx }) => {
        const flow = ctx.flows.get(input.flow_id) ?? null
        return { flow }
      },
    })
    .query("listFlows", {
      input: z.void(),
      output: z.object({
        flows: z.array(flowSchema),
      }),
      resolve: async ({ ctx }) => {
        return { flows: Array.from(ctx.flows.values()) }
      },
    })
})

export default flowsModule
