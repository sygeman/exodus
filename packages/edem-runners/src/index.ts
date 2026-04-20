/**
 * Edem Runners — distributed task queue, runner registry, and execution.
 *
 * Mock implementation for integration testing.
 */

import { type Evento, type Module, nextDepth } from "@exodus/edem-core"

export interface Runner {
  id: string
  name: string
  tags: string[]
  status: "online" | "offline" | "busy"
}

export interface Task {
  id: string
  type: string
  input: unknown
  status: "pending" | "running" | "completed" | "failed"
  runnerId?: string
}

/**
 * Create the Runners module.
 *
 * Events:
 *   Commands:  runners:register, runners:create_task, runners:get_task
 *   Facts:     runners:registered, tasks:created, tasks:started, tasks:completed
 *   Errors:    runners:error, tasks:error
 */
export function createRunnersModule(): Module {
  const runners = new Map<string, Runner>()
  const tasks = new Map<string, Task>()

  return {
    name: "runners",
    init(evento: Evento) {
      // Register runner
      evento.handle("runners:register", (ctx) => {
        const { name, tags } = ctx.payload as { name: string; tags: string[] }
        const id = crypto.randomUUID()
        const runner: Runner = { id, name, tags, status: "online" }
        runners.set(id, runner)

        evento.emit("runners:registered", { runnerId: id, name, tags }, nextDepth(ctx.meta))

        return { runnerId: id }
      })

      // Create task
      evento.handle("runners:create_task", (ctx) => {
        const { type, input } = ctx.payload as { type: string; input: unknown }
        const id = crypto.randomUUID()
        const task: Task = { id, type, input, status: "pending" }
        tasks.set(id, task)

        evento.emit("tasks:created", { taskId: id, type, input }, nextDepth(ctx.meta))

        // Simulate task execution
        setTimeout(() => {
          task.status = "running"
          evento.emit("tasks:started", { taskId: id, runnerId: "local" }, nextDepth(ctx.meta))

          setTimeout(() => {
            task.status = "completed"
            evento.emit(
              "tasks:completed",
              { taskId: id, output: { success: true } },
              nextDepth(ctx.meta),
            )
          }, 10)
        }, 10)

        return { taskId: id }
      })

      // Get task
      evento.handle("runners:get_task", (ctx) => {
        const { taskId } = ctx.payload as { taskId: string }
        const task = tasks.get(taskId)
        if (!task) throw new Error(`Task ${taskId} not found`)
        return task
      })
    },
  }
}
