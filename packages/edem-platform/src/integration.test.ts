import { describe, expect, it } from "bun:test"
import { createPlatform } from "./index"

describe("Platform — Data", () => {
  it("creates an item", async () => {
    const { evento } = await createPlatform()

    const result = (await evento.request("data:create_item", {
      collectionId: "games",
      data: { title: "Elden Ring" },
    })) as { itemId: string }

    expect(result.itemId).toBeDefined()
    expect(result.itemId).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it("queries items by collection", async () => {
    const { evento } = await createPlatform()

    await evento.request("data:create_item", {
      collectionId: "games",
      data: { title: "Elden Ring" },
    })
    await evento.request("data:create_item", {
      collectionId: "games",
      data: { title: "Dark Souls" },
    })
    await evento.request("data:create_item", {
      collectionId: "movies",
      data: { title: "Inception" },
    })

    const result = (await evento.request("data:query_items", {
      collectionId: "games",
    })) as { items: unknown[]; total: number }

    expect(result.total).toBe(2)
  })
})

describe("Platform — Flows", () => {
  it("creates and runs a flow", async () => {
    const { evento } = await createPlatform()

    const flowResult = (await evento.request("flows:create_flow", {
      name: "Auto-tag",
      trigger: "event",
    })) as { flowId: string }

    const runResult = (await evento.request("flows:run_flow", {
      flowId: flowResult.flowId,
    })) as { status: string }

    expect(runResult.status).toBe("success")
  })

  it("flow creates data items", async () => {
    const { evento } = await createPlatform()
    const events: string[] = []

    evento.on("data:item_created", () => events.push("item_created"))

    const flowResult = (await evento.request("flows:create_flow", {
      name: "Test",
      trigger: "manual",
    })) as { flowId: string }

    await evento.request("flows:run_flow", { flowId: flowResult.flowId })

    expect(events).toContain("item_created")
  })
})

describe("Platform — Cross-module communication", () => {
  it("trace_id links events across modules", async () => {
    const { evento } = await createPlatform()
    const traceIds = new Set<string>()

    evento.on("data:item_created", (ctx) => traceIds.add(ctx.meta.trace_id))
    evento.on("flows:run_completed", (ctx) => traceIds.add(ctx.meta.trace_id))

    const flowResult = (await evento.request("flows:create_flow", {
      name: "Test",
      trigger: "manual",
    })) as { flowId: string }

    await evento.request("flows:run_flow", { flowId: flowResult.flowId })

    expect(traceIds.size).toBe(1)
  })

  it("depth increases across module boundaries", async () => {
    const { evento } = await createPlatform()
    const depths: number[] = []

    evento.on("data:item_created", (ctx) => depths.push(ctx.meta.depth))
    evento.on("flows:run_completed", (ctx) => depths.push(ctx.meta.depth))

    const flowResult = (await evento.request("flows:create_flow", {
      name: "Test",
      trigger: "manual",
    })) as { flowId: string }

    await evento.request("flows:run_flow", { flowId: flowResult.flowId })

    expect(depths.some((d) => d > 0)).toBe(true)
  })
})

describe("Platform — UI", () => {
  it("creates a page", async () => {
    const { evento } = await createPlatform()

    const result = (await evento.request("ui:create_page", {
      name: "Games",
      route: "/games",
    })) as { pageId: string }

    expect(result.pageId).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it("renders page with data", async () => {
    const { evento } = await createPlatform()

    await evento.request("data:create_item", {
      collectionId: "games",
      data: { title: "Elden Ring" },
    })

    const pageResult = (await evento.request("ui:create_page", {
      name: "Games",
      route: "/games",
    })) as { pageId: string }

    const renderResult = (await evento.request("ui:render_page", {
      pageId: pageResult.pageId,
      collectionId: "games",
    })) as { items: unknown[] }

    expect(renderResult.items).toHaveLength(1)
  })
})

describe("Platform — Runners", () => {
  it("registers a runner", async () => {
    const { evento } = await createPlatform()

    const result = (await evento.request("runners:register", {
      name: "Local Runner",
      tags: ["storage", "conversion"],
    })) as { runnerId: string }

    expect(result.runnerId).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it("creates and completes a task", async () => {
    const { evento } = await createPlatform()
    const events: string[] = []

    evento.on("tasks:created", () => events.push("created"))
    evento.on("tasks:started", () => events.push("started"))
    evento.on("tasks:completed", () => events.push("completed"))

    const result = (await evento.request("runners:create_task", {
      type: "download",
      input: { url: "https://example.com/file.zip" },
    })) as { taskId: string }

    expect(result.taskId).toBeDefined()

    // Wait for async task completion
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(events).toContain("created")
    expect(events).toContain("started")
    expect(events).toContain("completed")
  })
})

describe("Platform — MCP", () => {
  it("registers and lists tools", async () => {
    const { evento } = await createPlatform()

    await evento.request("mcp:register_tools", {
      module: "data",
      tools: [
        { name: "data_create_item", description: "Create an item" },
        { name: "data_query_items", description: "Query items" },
      ],
    })

    const result = (await evento.request("mcp:list_tools", {})) as {
      tools: unknown[]
    }

    expect(result.tools).toHaveLength(2)
  })

  it("calls tool via MCP proxy", async () => {
    const { evento } = await createPlatform()

    await evento.request("mcp:register_tools", {
      module: "data",
      tools: [{ name: "data:create_item", description: "Create an item" }],
    })

    const result = (await evento.request("mcp:call_tool", {
      name: "data:create_item",
      args: { collectionId: "games", data: { title: "Elden Ring" } },
    })) as { itemId: string }

    expect(result.itemId).toBeDefined()
  })
})

describe("Platform — Full stack", () => {
  it("all modules are registered", async () => {
    const { core } = await createPlatform()

    expect(core.getModuleNames()).toEqual(["data", "flows", "ui", "runners", "mcp"])
  })

  it("end-to-end: flow → data → ui → runner", async () => {
    const { evento } = await createPlatform()

    // Flow creates data
    const flowResult = (await evento.request("flows:create_flow", {
      name: "Test Flow",
      trigger: "manual",
    })) as { flowId: string }

    await evento.request("flows:run_flow", { flowId: flowResult.flowId })

    // UI renders the data
    const pageResult = (await evento.request("ui:create_page", {
      name: "Test",
      route: "/test",
    })) as { pageId: string }

    const renderResult = (await evento.request("ui:render_page", {
      pageId: pageResult.pageId,
      collectionId: "flows_output",
    })) as { items: unknown[] }

    expect(renderResult.items.length).toBeGreaterThan(0)

    // Runner processes the result
    const taskResult = (await evento.request("runners:create_task", {
      type: "process",
      input: { data: renderResult.items },
    })) as { taskId: string }

    expect(taskResult.taskId).toBeDefined()
  })
})
