import { describe, expect, it } from "bun:test"
import { createPlatform } from "./index"

describe("Platform — Data", () => {
  it("creates an item", async () => {
    const edem = createPlatform()

    const result = (await edem.data.createItem({
      collectionId: "games",
      data: { title: "Elden Ring" },
    })) as { itemId: string }

    expect(result.itemId).toBeDefined()
    expect(result.itemId).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it("queries items by collection", async () => {
    const edem = createPlatform()

    await edem.data.createItem({
      collectionId: "games",
      data: { title: "Elden Ring" },
    })
    await edem.data.createItem({
      collectionId: "games",
      data: { title: "Dark Souls" },
    })
    await edem.data.createItem({
      collectionId: "movies",
      data: { title: "Inception" },
    })

    const result = (await edem.data.queryItems("games")) as {
      items: unknown[]
      total: number
    }

    expect(result.total).toBe(2)
  })
})

describe("Platform — Flows", () => {
  it("creates and runs a flow", async () => {
    const edem = createPlatform()

    const flowResult = (await edem.flows.createFlow({
      name: "Auto-tag",
      trigger: "event",
    })) as { flowId: string }

    const runResult = (await edem.flows.runFlow(flowResult.flowId)) as {
      status: string
    }

    expect(runResult.status).toBe("success")
  })

  it("flow creates data items", async () => {
    const edem = createPlatform()
    const events: string[] = []

    edem.on("data:item_created", () => events.push("item_created"))

    const flowResult = (await edem.flows.createFlow({
      name: "Test",
      trigger: "manual",
    })) as { flowId: string }

    await edem.flows.runFlow(flowResult.flowId)

    expect(events).toContain("item_created")
  })
})

describe("Platform — Cross-module communication", () => {
  it("modules can listen to each other's events", async () => {
    const edem = createPlatform()
    const events: string[] = []

    edem.on("data:item_created", () => events.push("item_created"))
    edem.on("flows:run_completed", () => events.push("flow_completed"))

    const flowResult = (await edem.flows.createFlow({
      name: "Test",
      trigger: "manual",
    })) as { flowId: string }

    await edem.flows.runFlow(flowResult.flowId)

    expect(events).toContain("item_created")
    expect(events).toContain("flow_completed")
  })
})

describe("Platform — UI", () => {
  it("creates a page", async () => {
    const edem = createPlatform()

    const result = (await edem.ui.createPage({
      name: "Games",
      route: "/games",
    })) as { pageId: string }

    expect(result.pageId).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it("renders page with data", async () => {
    const edem = createPlatform()

    await edem.data.createItem({
      collectionId: "games",
      data: { title: "Elden Ring" },
    })

    const pageResult = (await edem.ui.createPage({
      name: "Games",
      route: "/games",
    })) as { pageId: string }

    const renderResult = (await edem.ui.renderPage({
      pageId: pageResult.pageId,
      collectionId: "games",
    })) as { items: unknown[] }

    expect(renderResult.items).toHaveLength(1)
  })
})

describe("Platform — Runners", () => {
  it("registers a runner", async () => {
    const edem = createPlatform()

    const result = (await edem.runners.register({
      name: "Local Runner",
      tags: ["storage", "conversion"],
    })) as { runnerId: string }

    expect(result.runnerId).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it("creates and completes a task", async () => {
    const edem = createPlatform()
    const events: string[] = []

    edem.on("tasks:created", () => events.push("created"))
    edem.on("tasks:started", () => events.push("started"))
    edem.on("tasks:completed", () => events.push("completed"))

    const result = (await edem.runners.createTask({
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
    const edem = createPlatform()

    await edem.mcp.registerTools({
      module: "data",
      tools: [
        { name: "data_create_item", description: "Create an item" },
        { name: "data_query_items", description: "Query items" },
      ],
    })

    const result = (await edem.mcp.listTools()) as {
      tools: unknown[]
    }

    expect(result.tools).toHaveLength(2)
  })

  it("calls tool via MCP proxy", async () => {
    const edem = createPlatform()

    await edem.mcp.registerTools({
      module: "data",
      tools: [{ name: "data:create_item", description: "Create an item" }],
    })

    const result = (await edem.mcp.callTool({
      name: "data:create_item",
      args: { collectionId: "games", data: { title: "Elden Ring" } },
    })) as { itemId: string }

    expect(result.itemId).toBeDefined()
  })
})

describe("Platform — Full stack", () => {
  it("all modules are registered", () => {
    const edem = createPlatform()

    expect(edem.data).toBeDefined()
    expect(edem.flows).toBeDefined()
    expect(edem.ui).toBeDefined()
    expect(edem.runners).toBeDefined()
    expect(edem.mcp).toBeDefined()
  })

  it("end-to-end: flow → data → ui → runner", async () => {
    const edem = createPlatform()

    // Flow creates data
    const flowResult = (await edem.flows.createFlow({
      name: "Test Flow",
      trigger: "manual",
    })) as { flowId: string }

    await edem.flows.runFlow(flowResult.flowId)

    // UI renders the data
    const pageResult = (await edem.ui.createPage({
      name: "Test",
      route: "/test",
    })) as { pageId: string }

    const renderResult = (await edem.ui.renderPage({
      pageId: pageResult.pageId,
      collectionId: "flows_output",
    })) as { items: unknown[] }

    expect(renderResult.items.length).toBeGreaterThan(0)

    // Runner processes the result
    const taskResult = (await edem.runners.createTask({
      type: "process",
      input: { data: renderResult.items },
    })) as { taskId: string }

    expect(taskResult.taskId).toBeDefined()
  })
})
