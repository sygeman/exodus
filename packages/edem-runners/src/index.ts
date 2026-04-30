import { z } from "zod"
import { createEdemModule } from "@exodus/edem-core"

export const runnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  status: z.enum(["online", "offline", "busy"]),
})

export const taskSchema = z.object({
  id: z.string(),
  type: z.string(),
  input: z.unknown(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  runner_id: z.string().optional(),
})

export const runnersModule = createEdemModule("runners", (module) => {
  return module
    .context(async () => ({
      runners: new Map<string, z.infer<typeof runnerSchema>>(),
      tasks: new Map<string, z.infer<typeof taskSchema>>(),
    }))
    .subscription("runnerRegistered", {
      output: z.object({
        runner_id: z.string(),
        name: z.string(),
        tags: z.array(z.string()),
      }),
    })
    .subscription("taskCreated", {
      output: z.object({
        task_id: z.string(),
        type: z.string(),
      }),
    })
    .subscription("taskStarted", {
      output: z.object({
        task_id: z.string(),
        runner_id: z.string(),
      }),
    })
    .subscription("taskCompleted", {
      output: z.object({
        task_id: z.string(),
        output: z.unknown(),
      }),
    })
    .mutation("registerRunner", {
      input: z.object({
        name: z.string(),
        tags: z.array(z.string()),
      }),
      output: z.object({
        runner_id: z.string(),
      }),
      resolve: async ({ input, ctx, emit }) => {
        const id = crypto.randomUUID()
        const runner = { id, name: input.name, tags: input.tags, status: "online" as const }
        ctx.runners.set(id, runner)
        await emit.runnerRegistered({ runner_id: id, name: input.name, tags: input.tags })
        return { runner_id: id }
      },
    })
    .mutation("createTask", {
      input: z.object({
        type: z.string(),
        input: z.unknown(),
      }),
      output: z.object({
        task_id: z.string(),
      }),
      resolve: async ({ input, ctx, emit }) => {
        const id = crypto.randomUUID()
        const task = { id, type: input.type, input: input.input, status: "pending" as const }
        ctx.tasks.set(id, task)
        await emit.taskCreated({ task_id: id, type: input.type })
        return { task_id: id }
      },
    })
    .query("getTask", {
      input: z.object({
        task_id: z.string(),
      }),
      output: z.object({
        task: taskSchema.nullable(),
      }),
      resolve: async ({ input, ctx }) => {
        const task = ctx.tasks.get(input.task_id) ?? null
        return { task }
      },
    })
    .query("listRunners", {
      input: z.void(),
      output: z.object({
        runners: z.array(runnerSchema),
      }),
      resolve: async ({ ctx }) => {
        return { runners: Array.from(ctx.runners.values()) }
      },
    })
})

export default runnersModule
