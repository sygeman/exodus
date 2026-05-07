import { parseEvery, matchesSchedule, type ScheduleTrigger } from "./manifest"

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
  queryItems: (input: { collection_id: string }) => Promise<{ items: FlowItem[] | RunItem[] }>
}

interface ScheduleEntry {
  flowId: string
  trigger: ScheduleTrigger
  intervalMs: number
  intervalTimer: ReturnType<typeof setInterval> | null
  initialTimer: ReturnType<typeof setTimeout> | null
}

const schedules = new Map<string, ScheduleEntry>()

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

async function runFlowWithRetry(flows: FlowsAPI, flowId: string): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await flows.runFlow({ flow_id: flowId })
      return
    } catch (err) {
      lastError = err
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * 2 ** attempt
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  console.error(
    `[flows:scheduler] Failed to run flow ${flowId} after ${MAX_RETRIES + 1} attempts:`,
    lastError,
  )
}

async function resumeRunWithRetry(flows: FlowsAPI, runId: string): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await flows.resumeRun({ run_id: runId })
      return
    } catch (err) {
      lastError = err
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * 2 ** attempt
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  console.error(
    `[flows:scheduler] Failed to resume run ${runId} after ${MAX_RETRIES + 1} attempts:`,
    lastError,
  )
}

async function handleNodeFailedWithRetry(
  flows: FlowsAPI,
  runId: string,
  nodeId: string,
  error: string,
): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await flows.handleNodeFailed({ run_id: runId, node_id: nodeId, error })
      return
    } catch (err) {
      lastError = err
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * 2 ** attempt
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  console.error(
    `[flows:scheduler] Failed to fail run ${runId} after ${MAX_RETRIES + 1} attempts:`,
    lastError,
  )
}

let delayCheckTimer: ReturnType<typeof setInterval> | null = null

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
        handleNodeFailedWithRetry(
          flows,
          run.id,
          waitingNodeId,
          `Node "${waitingNodeId}" timed out`,
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
        resumeRunWithRetry(flows, run.id).catch(() => {})
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
  if (!matchesSchedule(trigger, now)) return

  runFlowWithRetry(flows, flowId).catch(() => {})
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

function stopAll(): void {
  for (const [flowId] of schedules) {
    clearSchedule(flowId)
  }
}

export async function startScheduler(
  flows: FlowsAPI,
  data: DataAPI,
): Promise<{ stop: () => void }> {
  stopAll()
  if (delayCheckTimer) {
    clearInterval(delayCheckTimer)
    delayCheckTimer = null
  }

  const { items } = await data.queryItems({ collection_id: "flows" })

  for (const item of items) {
    const trigger = item.data.trigger as Record<string, unknown> | undefined
    if (trigger?.type === "schedule") {
      const lastRunAt = item.data.last_run_at as number | undefined
      setupSchedule(item.id, trigger as ScheduleTrigger, flows, lastRunAt)
    }
  }

  const unsubCreated = flows.flowCreated(({ event }) => {
    const flow = event as { id: string; trigger: ScheduleTrigger }
    if (flow.trigger?.type === "schedule") {
      setupSchedule(flow.id, flow.trigger, flows)
    }
  })

  const unsubUpdated = flows.flowUpdated(({ event }) => {
    const flow = event as { id: string; trigger: ScheduleTrigger }
    if (flow.trigger?.type === "schedule") {
      setupSchedule(flow.id, flow.trigger, flows)
    } else {
      clearSchedule(flow.id)
    }
  })

  const unsubDeleted = flows.flowDeleted(({ event }) => {
    const { flow_id } = event as { flow_id: string }
    clearSchedule(flow_id)
  })

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
