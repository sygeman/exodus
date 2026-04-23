/**
 * Edem Runners — distributed task queue, runner registry, and execution.
 *
 * Mock implementation for integration testing.
 */

import { type Edem } from "@exodus/edem-core"

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
export function createRunnersModule(edem: Edem) {
  const runners = new Map<string, Runner>()
  const tasks = new Map<string, Task>()

  // Register runner
  edem.handle("runners:register", (ctx) => {
    const { name, tags } = ctx.payload as { name: string; tags: string[] }
    const id = crypto.randomUUID()
    const runner: Runner = { id, name, tags, status: "online" }
    runners.set(id, runner)

    edem.emit("runners:registered", { runnerId: id, name, tags })

    return { runnerId: id }
  })

  // Create task
  edem.handle("runners:create_task", (ctx) => {
    const { type, input } = ctx.payload as { type: string; input: unknown }
    const id = crypto.randomUUID()
    const task: Task = { id, type, input, status: "pending" }
    tasks.set(id, task)

    edem.emit("tasks:created", { taskId: id, type, input })

    // Simulate task execution
    setTimeout(() => {
      task.status = "running"
      edem.emit("tasks:started", { taskId: id, runnerId: "local" })

      setTimeout(() => {
        task.status = "completed"
        edem.emit("tasks:completed", { taskId: id, output: { success: true } })
      }, 10)
    }, 10)

    return { taskId: id }
  })

  // Get task
  edem.handle("runners:get_task", (ctx) => {
    const { taskId } = ctx.payload as { taskId: string }
    const task = tasks.get(taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)
    return task
  })

  // === Public API ===
  edem.runners = {
    register: (params: { name: string; tags: string[] }) =>
      edem.request("runners:register", params),
    createTask: (params: { type: string; input: unknown }) =>
      edem.request("runners:create_task", params),
    getTask: (taskId: string) => edem.request("runners:get_task", { taskId }),
  }
}
