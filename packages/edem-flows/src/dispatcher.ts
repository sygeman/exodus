interface FlowItem {
  id: string
  data: Record<string, unknown>
}

interface EventFlowEntry {
  flowId: string
  trigger: EventTrigger
}

interface EventTrigger {
  type: "event"
  event: string
  filter?: Record<string, unknown>
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
let flowsRef: FlowsAPI | null = null

import { withRetry } from "./retry"

function rebuildIndex(items: FlowItem[]): void {
  eventFlows.clear()
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

    withRetry(
      () => flowsRef!.runFlow({ flow_id: entry.flowId, trigger_data: triggerData }),
      "dispatcher",
      `run flow ${entry.flowId}`,
    ).catch(() => {})
  }
}

export async function startDispatcher(
  flows: FlowsAPI,
  data: DataAPI,
): Promise<{
  emit: (name: string, payload: Record<string, unknown>) => void
  stop: () => void
}> {
  eventFlows.clear()
  flowsRef = flows

  const { items } = await data.queryItems({ collection_id: "flows" })
  rebuildIndex(items)

  const refresh = () => {
    data
      .queryItems({ collection_id: "flows" })
      .then(({ items: refreshed }) => rebuildIndex(refreshed))
      .catch(console.error)
  }

  const unsubFlowCreated = flows.flowCreated(refresh)
  const unsubFlowUpdated = flows.flowUpdated(refresh)
  const unsubFlowDeleted = flows.flowDeleted(refresh)

  const unsubItemCreated = data.itemCreated(({ event }) => {
    const item = event as DataItemEvent
    triggerFlows(`item:created:${item.collection_id}`, { item })
  })

  const unsubItemUpdated = data.itemUpdated(({ event }) => {
    const item = event as DataItemEvent
    triggerFlows(`item:updated:${item.collection_id}`, { item })
  })

  const unsubItemDeleted = data.itemDeleted(({ event }) => {
    const item = event as { id: string; collection_id: string }
    triggerFlows(`item:deleted:${item.collection_id}`, { item })
  })

  console.log(`[flows:dispatcher] Watching ${eventFlows.size} event triggers`)

  return {
    emit(name: string, payload: Record<string, unknown>): void {
      triggerFlows(name, payload)
    },
    stop() {
      unsubFlowCreated()
      unsubFlowUpdated()
      unsubFlowDeleted()
      unsubItemCreated()
      unsubItemUpdated()
      unsubItemDeleted()
      flowsRef = null
      eventFlows.clear()
      console.log("[flows:dispatcher] Stopped")
    },
  }
}
