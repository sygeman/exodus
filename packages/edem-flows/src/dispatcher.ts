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
    if (!matchFilter(triggerData, entry.trigger.filter)) continue

    flowsRef.runFlow({ flow_id: entry.flowId, trigger_data: triggerData }).catch((err: unknown) => {
      console.error(
        `[flows:dispatcher] Failed to run flow ${entry.flowId} for event "${eventName}":`,
        err,
      )
    })
  }
}

export async function startDispatcher(
  flows: FlowsAPI,
  data: DataAPI,
): Promise<{ emit: (name: string, payload: Record<string, unknown>) => void }> {
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

  console.log(`[flows:dispatcher] Watching ${eventFlows.size} event triggers`)

  return {
    emit(name: string, payload: Record<string, unknown>): void {
      triggerFlows(name, payload)
    },
  }
}
