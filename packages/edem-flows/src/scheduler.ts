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
  intervalTimer: ReturnType<typeof setInterval> | null
  initialTimer: ReturnType<typeof setTimeout> | null
}

const schedules = new Map<string, ScheduleEntry>()

function clearSchedule(flowId: string): void {
  const entry = schedules.get(flowId)
  if (entry) {
    if (entry.intervalTimer) clearInterval(entry.intervalTimer)
    if (entry.initialTimer) clearTimeout(entry.initialTimer)
    schedules.delete(flowId)
  }
}

function runWithScheduleCheck(flowId: string, trigger: ScheduleTrigger, flows: FlowsAPI): void {
  const now = new Date()
  if (!matchesSchedule(trigger, now)) return

  flows.runFlow({ flow_id: flowId }).catch((err: unknown) => {
    console.error(`[flows:scheduler] Failed to run flow ${flowId}:`, err)
  })
}

function setupSchedule(
  flowId: string,
  trigger: ScheduleTrigger,
  flows: FlowsAPI,
  lastRunAt?: number,
): void {
  clearSchedule(flowId)

  const intervalMs = parseEvery(trigger.every)
  if (intervalMs < 60000) {
    console.warn(`[flows:scheduler] Minimum interval is 1m, got ${trigger.every}`)
    return
  }

  const entry: ScheduleEntry = {
    flowId,
    trigger,
    intervalMs,
    intervalTimer: null,
    initialTimer: null,
  }

  const startInterval = () => {
    entry.intervalTimer = setInterval(() => {
      runWithScheduleCheck(flowId, trigger, flows)
    }, intervalMs)
  }

  if (lastRunAt) {
    const elapsed = Date.now() - lastRunAt
    const remaining = intervalMs - elapsed

    if (remaining <= 0) {
      runWithScheduleCheck(flowId, trigger, flows)
      startInterval()
    } else {
      entry.initialTimer = setTimeout(() => {
        entry.initialTimer = null
        runWithScheduleCheck(flowId, trigger, flows)
        startInterval()
      }, remaining)
    }
  } else {
    startInterval()
  }

  schedules.set(flowId, entry)
}

export async function startScheduler(flows: FlowsAPI, data: DataAPI): Promise<void> {
  const { items } = await data.queryItems({ collection_id: "flows" })

  for (const item of items) {
    const trigger = item.data.trigger as Record<string, unknown> | undefined
    if (trigger?.type === "schedule") {
      const lastRunAt = item.data.last_run_at as number | undefined
      setupSchedule(item.id, trigger as ScheduleTrigger, flows, lastRunAt)
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
