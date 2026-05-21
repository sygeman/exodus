import { getFlowTriggerSource } from "./manifest"

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
  queryItems: (input: {
    collection_id: string
    filter?: Record<string, unknown>
  }) => Promise<{ items: FlowItem[] }>
}

const eventFlows = new Map<string, EventFlowEntry[]>()
let flowsRef: FlowsAPI | null = null

import { withRetry } from "./retry"

export type FlowFilter = Record<string, unknown>

export type DispatcherOptions = {
  flowFilter?: FlowFilter
}

function rebuildIndex(items: FlowItem[]): void {
  eventFlows.clear()
  for (const item of items) {
    const trigger = getFlowTriggerSource({
      kind: item.data.kind as string | undefined,
      nodes: item.data.nodes,
    })
    if (trigger?.type === "event") {
      const eventName = trigger.event
      const entry: EventFlowEntry = {
        flowId: item.id,
        trigger: {
          type: "event",
          event: eventName,
          filter: trigger.filter,
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
  options?: DispatcherOptions,
): Promise<{
  emit: (name: string, payload: Record<string, unknown>) => void
  stop: () => void
}> {
  eventFlows.clear()
  flowsRef = flows
  const flowFilter = options?.flowFilter

  const { items } = await data.queryItems({
    collection_id: "flows",
    filter: flowFilter,
  })
  rebuildIndex(items)

  const refresh = () => {
    data
      .queryItems({ collection_id: "flows", filter: flowFilter })
      .then(({ items: refreshed }) => rebuildIndex(refreshed))
      .catch(console.error)
  }

  const unsubFlowCreated = flows.flowCreated(refresh)
  const unsubFlowUpdated = flows.flowUpdated(refresh)
  const unsubFlowDeleted = flows.flowDeleted(refresh)

  console.log(`[flows:dispatcher] Watching ${eventFlows.size} event triggers`)

  return {
    emit(name: string, payload: Record<string, unknown>): void {
      triggerFlows(name, payload)
    },
    stop() {
      unsubFlowCreated()
      unsubFlowUpdated()
      unsubFlowDeleted()
      flowsRef = null
      eventFlows.clear()
      console.log("[flows:dispatcher] Stopped")
    },
  }
}
