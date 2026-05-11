import { shallowRef, ref, onMounted, onUnmounted } from "vue"
import type { InferModuleAPI } from "@exodus/edem-core"
import type { flowsModule } from "@exodus/edem-flows"

type FlowsAPI = InferModuleAPI<typeof flowsModule>

type FlowItem = Awaited<ReturnType<FlowsAPI["listFlows"]>>["flows"][number]
type RunItem = Awaited<ReturnType<FlowsAPI["listRuns"]>>["runs"][number]
type RunNodeItem = Awaited<ReturnType<FlowsAPI["getRunNodes"]>>["nodes"][number]

export function createFlowsHooks(flows: FlowsAPI) {
  function useFlows(filter?: { status?: string; name?: string }) {
    const data = shallowRef<FlowItem[]>([])
    const loading = ref(true)
    const error = ref<string | null>(null)
    const unsubs: (() => void)[] = []

    async function execute() {
      loading.value = true
      error.value = null
      try {
        const result = await flows.listFlows(filter as Parameters<FlowsAPI["listFlows"]>[0])
        data.value = result.flows
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
      } finally {
        loading.value = false
      }
    }

    function subscribe() {
      unsubs.push(
        flows.flowCreated(({ event }) => {
          data.value = [...data.value, event as FlowItem]
        }),
      )
      unsubs.push(
        flows.flowUpdated(({ event }) => {
          const updated = event as FlowItem
          const idx = data.value.findIndex((f) => f.id === updated.id)
          if (idx !== -1) {
            data.value = [...data.value.slice(0, idx), updated, ...data.value.slice(idx + 1)]
          }
        }),
      )
      unsubs.push(
        flows.flowDeleted(({ event }) => {
          data.value = data.value.filter((f) => f.id !== event.flow_id)
        }),
      )
    }

    onMounted(async () => {
      await execute()
      subscribe()
    })

    onUnmounted(() => {
      for (const unsub of unsubs) unsub()
      unsubs.length = 0
    })

    return { data, loading, error, refetch: execute }
  }

  function useFlow(flowId: string) {
    const data = shallowRef<FlowItem | null>(null)
    const loading = ref(true)
    const error = ref<string | null>(null)
    const unsubs: (() => void)[] = []

    async function execute() {
      loading.value = true
      error.value = null
      try {
        const result = await flows.getFlow({ flow_id: flowId })
        data.value = result.flow
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
      } finally {
        loading.value = false
      }
    }

    function subscribe() {
      unsubs.push(
        flows.flowUpdated(({ event }) => {
          const updated = event as FlowItem
          if (updated.id === flowId) {
            data.value = updated
          }
        }),
      )
      unsubs.push(
        flows.flowDeleted(({ event }) => {
          if (event.flow_id === flowId) {
            data.value = null
          }
        }),
      )
    }

    onMounted(async () => {
      await execute()
      subscribe()
    })

    onUnmounted(() => {
      for (const unsub of unsubs) unsub()
      unsubs.length = 0
    })

    return { data, loading, error, refetch: execute }
  }

  function useFlowRuns(flowId?: string) {
    const data = shallowRef<RunItem[]>([])
    const loading = ref(true)
    const error = ref<string | null>(null)
    const unsubs: (() => void)[] = []

    async function execute() {
      loading.value = true
      error.value = null
      try {
        const result = await flows.listRuns({ flow_id: flowId } as Parameters<
          FlowsAPI["listRuns"]
        >[0])
        data.value = result.runs
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
      } finally {
        loading.value = false
      }
    }

    function subscribe() {
      unsubs.push(
        flows.runStarted(({ event }) => {
          const run = event as RunItem
          if (!flowId || run.flow_id === flowId) {
            data.value = [run, ...data.value]
          }
        }),
      )
      unsubs.push(
        flows.runCompleted(({ event }) => {
          const run = event as RunItem
          const idx = data.value.findIndex((r) => r.id === run.id)
          if (idx !== -1) {
            data.value = [...data.value.slice(0, idx), run, ...data.value.slice(idx + 1)]
          }
        }),
      )
      unsubs.push(
        flows.runUpdated(({ event }) => {
          const run = event as RunItem
          const idx = data.value.findIndex((r) => r.id === run.id)
          if (idx !== -1) {
            data.value = [...data.value.slice(0, idx), run, ...data.value.slice(idx + 1)]
          }
        }),
      )
    }

    onMounted(async () => {
      await execute()
      subscribe()
    })

    onUnmounted(() => {
      for (const unsub of unsubs) unsub()
      unsubs.length = 0
    })

    return { data, loading, error, refetch: execute }
  }

  function useRun(runId: string) {
    const data = shallowRef<RunItem | null>(null)
    const loading = ref(true)
    const error = ref<string | null>(null)
    const unsubs: (() => void)[] = []

    async function execute() {
      loading.value = true
      error.value = null
      try {
        const result = await flows.getRun({ run_id: runId })
        data.value = result.run
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
      } finally {
        loading.value = false
      }
    }

    function subscribe() {
      unsubs.push(
        flows.runCompleted(({ event }) => {
          const run = event as RunItem
          if (run.id === runId) data.value = run
        }),
      )
      unsubs.push(
        flows.runUpdated(({ event }) => {
          const run = event as RunItem
          if (run.id === runId) data.value = run
        }),
      )
    }

    onMounted(async () => {
      await execute()
      subscribe()
    })

    onUnmounted(() => {
      for (const unsub of unsubs) unsub()
      unsubs.length = 0
    })

    return { data, loading, error, refetch: execute }
  }

  function useRunNodes(runId: string) {
    const data = shallowRef<RunNodeItem[]>([])
    const loading = ref(true)
    const error = ref<string | null>(null)
    const unsubs: (() => void)[] = []

    async function execute() {
      loading.value = true
      error.value = null
      try {
        const result = await flows.getRunNodes({ run_id: runId })
        data.value = result.nodes
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
      } finally {
        loading.value = false
      }
    }

    function subscribe() {
      unsubs.push(
        flows.runNodeStarted(({ event }) => {
          const node = event as RunNodeItem
          if (node.run_id === runId) {
            data.value = [...data.value, node]
          }
        }),
      )
      unsubs.push(
        flows.runNodeCompleted(({ event }) => {
          const node = event as RunNodeItem
          if (node.run_id === runId) {
            const idx = data.value.findIndex((n) => n.id === node.id)
            if (idx !== -1) {
              data.value = [...data.value.slice(0, idx), node, ...data.value.slice(idx + 1)]
            }
          }
        }),
      )
    }

    onMounted(async () => {
      await execute()
      subscribe()
    })

    onUnmounted(() => {
      for (const unsub of unsubs) unsub()
      unsubs.length = 0
    })

    return { data, loading, error, refetch: execute }
  }

  function useCreateFlow() {
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function mutate(
      input: Parameters<FlowsAPI["createFlow"]>[0],
    ): Promise<{ flow_id: string } | never> {
      loading.value = true
      error.value = null
      try {
        return await flows.createFlow(input)
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        loading.value = false
      }
    }

    return [mutate, { loading, error }] as const
  }

  function useUpdateFlow() {
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function mutate(
      input: Parameters<FlowsAPI["updateFlow"]>[0],
    ): Promise<{ success: boolean } | never> {
      loading.value = true
      error.value = null
      try {
        return await flows.updateFlow(input)
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        loading.value = false
      }
    }

    return [mutate, { loading, error }] as const
  }

  function useDeleteFlow() {
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function mutate(
      input: Parameters<FlowsAPI["deleteFlow"]>[0],
    ): Promise<{ success: boolean } | never> {
      loading.value = true
      error.value = null
      try {
        return await flows.deleteFlow(input)
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        loading.value = false
      }
    }

    return [mutate, { loading, error }] as const
  }

  function useRunFlow() {
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function mutate(
      input: Parameters<FlowsAPI["runFlow"]>[0],
    ): Promise<{ run_id: string; status: string } | never> {
      loading.value = true
      error.value = null
      try {
        return await flows.runFlow(input)
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        loading.value = false
      }
    }

    return [mutate, { loading, error }] as const
  }

  function useCancelRun() {
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function mutate(
      input: Parameters<FlowsAPI["cancelRun"]>[0],
    ): Promise<{ success: boolean } | never> {
      loading.value = true
      error.value = null
      try {
        return await flows.cancelRun(input)
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        loading.value = false
      }
    }

    return [mutate, { loading, error }] as const
  }

  function useResumeRun() {
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function mutate(
      input: Parameters<FlowsAPI["resumeRun"]>[0],
    ): Promise<{ success: boolean } | never> {
      loading.value = true
      error.value = null
      try {
        return await flows.resumeRun(input)
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        loading.value = false
      }
    }

    return [mutate, { loading, error }] as const
  }

  return {
    useFlows,
    useFlow,
    useFlowRuns,
    useRun,
    useRunNodes,
    useCreateFlow,
    useUpdateFlow,
    useDeleteFlow,
    useRunFlow,
    useCancelRun,
    useResumeRun,
  }
}
