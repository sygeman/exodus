import { getFlowTriggerSource, parseEvery, matchesSchedule, type ScheduleTrigger } from "./manifest"
import { withRetry } from "./retry"
import type { FlowFilter } from "./dispatcher"

interface FlowItem {
  id: string
  data: Record<string, unknown>
}

interface RunItem {
  id: string
  data: Record<string, unknown>
}

interface FlowsAPI {
  runFlow: (input: {
    flow_id: string
    trigger_data?: Record<string, unknown>
  }) => Promise<{ run_id: string; status: string }>
  resumeRun: (input: { run_id: string }) => Promise<{ success: boolean }>
  handleNodeFailed: (input: {
    run_id: string
    node_id: string
    error: string
  }) => Promise<{ success: boolean }>
  flowCreated: (handler: (args: { event: unknown }) => void) => () => void
  flowUpdated: (handler: (args: { event: unknown }) => void) => () => void
  flowDeleted: (handler: (args: { event: unknown }) => void) => () => void
}

interface DataAPI {
  queryItems: (input: {
    collection_id: string
    filter?: Record<string, unknown>
  }) => Promise<{ items: FlowItem[] | RunItem[] }>
}

interface ScheduleEntry {
  flowId: string
  trigger: ScheduleTrigger
  intervalMs: number
  intervalTimer: ReturnType<typeof setInterval> | null
  initialTimer: ReturnType<typeof setTimeout> | null
}

const schedules = new Map<string, ScheduleEntry>()

let delayCheckTimer: ReturnType<typeof setInterval> | null = null

export type SchedulerOptions = {
  flowFilter?: FlowFilter
}

async function checkDelayedRunsAndTimeouts(flows: FlowsAPI, data: DataAPI): Promise<void> {
  try {
    const { items: runs } = await data.queryItems({ collection_id: "flow_runs" })
    const now = Date.now()

    for (const run of runs) {
      if (run.data.status !== "waiting") continue

      const waitingNodeId = run.data.waiting_node_id as string | undefined
      if (!waitingNodeId) continue

      const timeoutAt = run.data.timeout_at as number | undefined
      if (timeoutAt && now >= timeoutAt) {
        withRetry(
          () =>
            flows.handleNodeFailed({
              run_id: run.id,
              node_id: waitingNodeId,
              error: `Node "${waitingNodeId}" timed out`,
            }),
          "scheduler",
          `fail run ${run.id}`,
        ).catch(() => {})
        continue
      }

      const context = run.data.context as
        | {
            node_outputs?: Record<string, Record<string, unknown>>
          }
        | undefined

      if (!context?.node_outputs) continue

      const nodeOutput = context.node_outputs[waitingNodeId]
      if (
        !nodeOutput ||
        nodeOutput.status !== "pending" ||
        nodeOutput.resume_at === null ||
        nodeOutput.resume_at === undefined
      )
        continue

      const resumeAt = nodeOutput.resume_at as number
      if (now >= resumeAt) {
        withRetry(
          () => flows.resumeRun({ run_id: run.id }),
          "scheduler",
          `resume run ${run.id}`,
        ).catch(() => {})
      }
    }
  } catch (err) {
    console.error("[flows:scheduler] Error checking delayed runs and timeouts:", err)
  }
}

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
  const matches = matchesSchedule(trigger, now)
  console.log(
    `[flows:scheduler] Schedule check for ${flowId}: matches=${matches}, now=${now.toISOString()}`,
  )
  if (!matches) return

  console.log(`[flows:scheduler] Running flow ${flowId}`)
  withRetry(() => flows.runFlow({ flow_id: flowId }), "scheduler", `run flow ${flowId}`).catch(
    () => {},
  )
}

function setupSchedule(flowId: string, trigger: ScheduleTrigger, flows: FlowsAPI): void {
  clearSchedule(flowId)

  const intervalMs = parseEvery(trigger.every)
  if (intervalMs < 60000) {
    console.warn(`[flows:scheduler] Minimum interval is 1m, got ${trigger.every}`)
    return
  }

  console.log(`[flows:scheduler] Setting up schedule for ${flowId}: every=${trigger.every}`)

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

  runWithScheduleCheck(flowId, trigger, flows)
  startInterval()

  schedules.set(flowId, entry)
}

function stopAll(): void {
  for (const [flowId] of schedules) {
    clearSchedule(flowId)
  }
}

async function reloadSchedules(
  flows: FlowsAPI,
  data: DataAPI,
  flowFilter?: FlowFilter,
): Promise<void> {
  stopAll()

  const { items } = await data.queryItems({
    collection_id: "flows",
    filter: flowFilter,
  })

  for (const item of items) {
    const trigger = getFlowTriggerSource({
      kind: item.data.kind as string | undefined,
      nodes: item.data.nodes,
    })
    if (trigger?.type === "schedule") {
      setupSchedule(item.id, trigger, flows)
    }
  }
}

export async function startScheduler(
  flows: FlowsAPI,
  data: DataAPI,
  options?: SchedulerOptions,
): Promise<{ stop: () => void }> {
  stopAll()
  if (delayCheckTimer) {
    clearInterval(delayCheckTimer)
    delayCheckTimer = null
  }

  const flowFilter = options?.flowFilter

  await reloadSchedules(flows, data, flowFilter)

  const refreshSchedules = () => {
    reloadSchedules(flows, data, flowFilter).catch((err) => {
      console.error("[flows:scheduler] Failed to refresh schedules:", err)
    })
  }

  const unsubCreated = flows.flowCreated(refreshSchedules)

  const unsubUpdated = flows.flowUpdated(refreshSchedules)

  const unsubDeleted = flows.flowDeleted(refreshSchedules)

  delayCheckTimer = setInterval(() => {
    checkDelayedRunsAndTimeouts(flows, data).catch(() => {})
  }, 10000)

  console.log(`[flows:scheduler] Started ${schedules.size} scheduled flows`)

  return {
    stop() {
      stopAll()
      if (delayCheckTimer) {
        clearInterval(delayCheckTimer)
        delayCheckTimer = null
      }
      unsubCreated()
      unsubUpdated()
      unsubDeleted()
      console.log(`[flows:scheduler] Stopped`)
    },
  }
}
