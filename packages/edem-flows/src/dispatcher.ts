interface FlowItem {
  id: string
  data: Record<string, unknown>
}

interface EventFlowEntry {
  flowId: string
  trigger: EventTrigger | WebhookTrigger
}

interface EventTrigger {
  type: "event"
  event: string
  filter?: Record<string, unknown>
}

interface WebhookTrigger {
  type: "webhook"
  path: string
}

interface FlowsAPI {
  runFlow: (input: {
    flow_id: string
    trigger_data?: Record<string, unknown>
  }) => Promise<{ run_id: string; status: string }>
  flowCreated: (handler: (args: { event: unknown }) => void) => () => void
  flowUpdated: (handler: (args: { event: unknown }) => void) => () => void
  flowDeleted: (handler: (args: { event: unknown }) => void) => () => void
}

interface DataAPI {
  queryItems: (input: { collection_id: string }) => Promise<{ items: FlowItem[] }>
  itemCreated: (handler: (args: { event: unknown }) => void) => () => void
  itemUpdated: (handler: (args: { event: unknown }) => void) => () => void
  itemDeleted: (handler: (args: { event: unknown }) => void) => () => void
}

interface DataItemEvent {
  id: string
  collection_id: string
  data: Record<string, unknown>
}

const eventFlows = new Map<string, EventFlowEntry[]>()
const webhookFlows = new Map<string, EventFlowEntry[]>()
let flowsRef: FlowsAPI | null = null

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

async function runFlowWithRetry(
  flows: FlowsAPI,
  input: { flow_id: string; trigger_data?: Record<string, unknown> },
  context: string,
): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await flows.runFlow(input)
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
    `[flows:${context}] Failed to run flow ${input.flow_id} after ${MAX_RETRIES + 1} attempts:`,
    lastError,
  )
}

function rebuildIndex(items: FlowItem[]): void {
  eventFlows.clear()
  webhookFlows.clear()
  for (const item of items) {
    const trigger = item.data.trigger as Record<string, unknown> | undefined
    if (trigger?.type === "event") {
      const eventName = trigger.event as string
      const entry: EventFlowEntry = {
        flowId: item.id,
        trigger: {
          type: "event",
          event: eventName,
          filter: trigger.filter as Record<string, unknown> | undefined,
        },
      }
      const existing = eventFlows.get(eventName) ?? []
      existing.push(entry)
      eventFlows.set(eventName, existing)
    } else if (trigger?.type === "webhook") {
      const path = trigger.path as string
      const entry: EventFlowEntry = {
        flowId: item.id,
        trigger: {
          type: "webhook",
          path,
        },
      }
      const existing = webhookFlows.get(path) ?? []
      existing.push(entry)
      webhookFlows.set(path, existing)
    }
  }
}

function matchFilter(data: Record<string, unknown>, filter?: Record<string, unknown>): boolean {
  if (!filter) return true
  for (const [key, value] of Object.entries(filter)) {
    if (data[key] !== value) return false
  }
  return true
}

function triggerFlows(eventName: string, triggerData: Record<string, unknown>): void {
  if (!flowsRef) return

  const entries = eventFlows.get(eventName)
  if (!entries) return

  for (const entry of entries) {
    if (entry.trigger.type === "event" && !matchFilter(triggerData, entry.trigger.filter)) continue

    runFlowWithRetry(
      flowsRef,
      { flow_id: entry.flowId, trigger_data: triggerData },
      "dispatcher",
    ).catch(() => {})
  }
}

function triggerWebhook(path: string, payload: Record<string, unknown>): void {
  if (!flowsRef) return

  const entries = webhookFlows.get(path)
  if (!entries) return

  for (const entry of entries) {
    runFlowWithRetry(
      flowsRef,
      { flow_id: entry.flowId, trigger_data: payload },
      "dispatcher",
    ).catch(() => {})
  }
}

export async function startDispatcher(
  flows: FlowsAPI,
  data: DataAPI,
): Promise<{
  emit: (name: string, payload: Record<string, unknown>) => void
  triggerWebhook: (path: string, payload: Record<string, unknown>) => void
}> {
  flowsRef = flows

  const { items } = await data.queryItems({ collection_id: "flows" })
  rebuildIndex(items)

  const refresh = () => {
    data
      .queryItems({ collection_id: "flows" })
      .then(({ items: refreshed }) => rebuildIndex(refreshed))
      .catch(console.error)
  }

  flows.flowCreated(refresh)
  flows.flowUpdated(refresh)
  flows.flowDeleted(refresh)

  data.itemCreated(({ event }) => {
    const item = event as DataItemEvent
    triggerFlows(`item:created:${item.collection_id}`, { item })
  })

  data.itemUpdated(({ event }) => {
    const item = event as DataItemEvent
    triggerFlows(`item:updated:${item.collection_id}`, { item })
  })

  data.itemDeleted(({ event }) => {
    const item = event as { id: string; collection_id: string }
    triggerFlows(`item:deleted:${item.collection_id}`, { item })
  })

  console.log(
    `[flows:dispatcher] Watching ${eventFlows.size} event triggers, ${webhookFlows.size} webhook triggers`,
  )

  return {
    emit(name: string, payload: Record<string, unknown>): void {
      triggerFlows(name, payload)
    },
    triggerWebhook(path: string, payload: Record<string, unknown>): void {
      triggerWebhook(path, payload)
    },
  }
}
