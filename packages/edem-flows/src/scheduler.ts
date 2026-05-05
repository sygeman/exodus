import { parseEvery, matchesSchedule, type ScheduleTrigger } from "./manifest"

interface FlowItem {
  id: string
  data: Record<string, unknown>
}

interface FlowsAPI {
  runFlow: (input: {
    flow_id: string
    trigger_data?: Record<string, unknown>
  }) => Promise<{ run_id: string; status: string }>
  listFlows: () => Promise<{
    flows: Array<{
      id: string
      name: string
      trigger: unknown
      nodes: unknown[]
      edges: unknown[]
    }>
  }>
  flowCreated: (handler: (args: { event: unknown }) => void) => () => void
  flowUpdated: (handler: (args: { event: unknown }) => void) => () => void
  flowDeleted: (handler: (args: { event: unknown }) => void) => () => void
}

interface DataAPI {
  queryItems: (input: { collection_id: string }) => Promise<{ items: FlowItem[] }>
}

interface ScheduleEntry {
  flowId: string
  trigger: ScheduleTrigger
  intervalMs: number
  timer: ReturnType<typeof setInterval>
}

const schedules = new Map<string, ScheduleEntry>()

function clearSchedule(flowId: string): void {
  const entry = schedules.get(flowId)
  if (entry) {
    clearInterval(entry.timer)
    schedules.delete(flowId)
  }
}

function setupSchedule(flowId: string, trigger: ScheduleTrigger, flows: FlowsAPI): void {
  clearSchedule(flowId)

  const intervalMs = parseEvery(trigger.every)
  if (intervalMs < 60000) {
    console.warn(`[flows:scheduler] Minimum interval is 1m, got ${trigger.every}`)
    return
  }

  const timer = setInterval(() => {
    const now = new Date()
    if (!matchesSchedule(trigger, now)) return

    flows.runFlow({ flow_id: flowId }).catch((err: unknown) => {
      console.error(`[flows:scheduler] Failed to run flow ${flowId}:`, err)
    })
  }, intervalMs)

  schedules.set(flowId, { flowId, trigger, intervalMs, timer })
}

export async function startScheduler(flows: FlowsAPI, data: DataAPI): Promise<void> {
  const { items } = await data.queryItems({ collection_id: "flows" })

  for (const item of items) {
    const trigger = item.data.trigger as Record<string, unknown> | undefined
    if (trigger?.type === "schedule") {
      setupSchedule(item.id, trigger as ScheduleTrigger, flows)
    }
  }

  flows.flowCreated(({ event }) => {
    const flow = event as { id: string; trigger: ScheduleTrigger }
    if (flow.trigger?.type === "schedule") {
      setupSchedule(flow.id, flow.trigger, flows)
    }
  })

  flows.flowUpdated(({ event }) => {
    const flow = event as { id: string; trigger: ScheduleTrigger }
    if (flow.trigger?.type === "schedule") {
      setupSchedule(flow.id, flow.trigger, flows)
    } else {
      clearSchedule(flow.id)
    }
  })

  flows.flowDeleted(({ event }) => {
    const { flow_id } = event as { flow_id: string }
    clearSchedule(flow_id)
  })

  console.log(`[flows:scheduler] Started ${schedules.size} scheduled flows`)
}
