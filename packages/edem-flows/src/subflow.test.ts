import { describe, it, expect, beforeEach } from "bun:test"
import { createEdem } from "@exodus/edem-core"
import { dataModule, resetDataEngine } from "@exodus/edem-data"
import { flowsModule } from "./index"

describe("flows: backup game saves", () => {
  let edem: ReturnType<typeof createEdem<[typeof dataModule, typeof flowsModule]>>

  beforeEach(async () => {
    resetDataEngine()
    edem = createEdem([dataModule, flowsModule])
  })

  it("full lifecycle: trigger → prepare → subflow → output", async () => {
    const { flow_id: childFlowId } = await edem.flows.createFlow({
      name: "Backup Single Game",
      trigger: { type: "manual" },
      nodes: [
        { id: "c_trigger", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "c_backup",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "result", operation: "set", value: "saved" },
        },
        {
          id: "c_output",
          type: "output",
          position: { x: 200, y: 0 },
          data: {
            outputs: {
              backed_up: "{{nodes.c_backup.output.result}}",
              game: "{{trigger.result}}",
            },
          },
        },
      ],
      edges: [
        { id: "ce1", source: "c_trigger", target: "c_backup" },
        { id: "ce2", source: "c_backup", target: "c_output" },
      ],
    })

    const { flow_id: parentFlowId } = await edem.flows.createFlow({
      name: "Backup All Games",
      trigger: { type: "manual" },
      nodes: [
        { id: "p_trigger", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "p_prepare",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "batch", operation: "set", value: "{{trigger.games}}" },
        },
        {
          id: "p_backup",
          type: "subflow",
          position: { x: 200, y: 0 },
          data: { flow_id: childFlowId },
        },
        {
          id: "p_done",
          type: "output",
          position: { x: 300, y: 0 },
          data: { outputs: { total: "1", status: "ok" } },
        },
      ],
      edges: [
        { id: "pe1", source: "p_trigger", target: "p_prepare" },
        { id: "pe2", source: "p_prepare", target: "p_backup" },
        { id: "pe3", source: "p_backup", target: "p_done" },
      ],
    })

    const result = await edem.flows.runFlow({
      flow_id: parentFlowId,
      trigger_data: {
        games: [{ name: "Elden Ring", savePath: "/saves/elden" }],
      },
    })

    expect(result.status).toBe("completed")

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run).not.toBeNull()
    expect(run?.flow_id).toBe(parentFlowId)
    expect(run?.status).toBe("completed")

    const { runs } = await edem.flows.listRuns({})
    const childRun = runs.find((r) => r.flow_id === childFlowId)
    expect(childRun).toBeDefined()
    expect(childRun?.parent_run_id).toBe(result.run_id)
    expect(childRun?.status).toBe("completed")

    const { nodes: parentNodes } = await edem.flows.getRunNodes({ run_id: result.run_id })
    const parentNodeIds = [...new Set(parentNodes.map((n) => n.node_id))]
    expect(parentNodeIds).toContainEqual("p_trigger")
    expect(parentNodeIds).toContainEqual("p_prepare")
    expect(parentNodeIds).toContainEqual("p_backup")
    expect(parentNodeIds).toContainEqual("p_done")
    expect(parentNodes.every((n) => n.status === "completed")).toBe(true)

    const { nodes: childNodes } = await edem.flows.getRunNodes({ run_id: childRun!.id })
    const childNodeIds = [...new Set(childNodes.map((n) => n.node_id))]
    expect(childNodeIds).toContainEqual("c_trigger")
    expect(childNodeIds).toContainEqual("c_backup")
    expect(childNodeIds).toContainEqual("c_output")
    expect(childNodes.every((n) => n.status === "completed")).toBe(true)

    const backupNode = childNodes.find((n) => n.node_id === "c_backup")
    expect(backupNode?.output).toEqual({ result: "saved" })

    const outputNode = childNodes.find((n) => n.node_id === "c_output")
    expect(outputNode?.output?.outputs).toEqual({
      backed_up: "saved",
      game: [{ name: "Elden Ring", savePath: "/saves/elden" }],
    })
  })
})
