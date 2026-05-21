import { createContext, setNodeOutput, setFlowVariable, type FlowContext } from "./context"
import { resolveNodeExecutor, type NodeExecutorResult } from "./executors"

export interface FlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data?: Record<string, unknown>
  retry_max?: number
  retry_delay?: number
  timeout?: number
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  condition?: string
  label?: string
}

export interface Flow {
  id: string
  name: string
  kind?: "flow" | "subflow"
  nodes: FlowNode[]
  edges: FlowEdge[]
  meta?: Record<string, unknown>
}

export interface NodeLifecycleEvent {
  run_id: string
  node_id: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  attempts: number
  started_at: number
  completed_at?: number
}

export interface NodeLifecycle {
  onNodeStarted?: (event: NodeLifecycleEvent) => void | Promise<void>
  onNodeCompleted?: (event: NodeLifecycleEvent) => void | Promise<void>
  onNodeFailed?: (event: NodeLifecycleEvent) => void | Promise<void>
}

/** Result of executing a flow or a single node. */
export interface ExecutionResult {
  context: FlowContext
  nodeResults: Map<string, NodeExecutorResult>
  status: "completed" | "error" | "waiting"
  error?: string
  waitingNodeId?: string
}

/**
 * Executes a flow graph starting from its trigger nodes.
 *
 * Walks the DAG, executing each node and following edges based on results.
 * Supports async nodes (loop, subflow) via waiting state, retries with
 * configurable delay, per-node timeouts, and AbortSignal cancellation.
 *
 * @param flow - The flow definition with nodes and edges
 * @param triggerData - Initial data passed to trigger nodes
 * @param existingContext - Optional restored context for resuming execution
 * @param options - Optional run_id, lifecycle callbacks, and AbortSignal
 */
export async function executeFlow(
  flow: Flow,
  triggerData: Record<string, unknown> = {},
  existingContext?: FlowContext,
  options?: { run_id?: string; lifecycle?: NodeLifecycle; signal?: AbortSignal },
): Promise<ExecutionResult> {
  const context = existingContext ?? createContext(triggerData)
  const nodeResults = new Map<string, NodeExecutorResult>()
  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]))

  if (options?.signal?.aborted) {
    return { context, nodeResults, status: "error", error: "Run cancelled" }
  }

  const adjacency = new Map<string, FlowEdge[]>()
  for (const edge of flow.edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, [])
    }
    adjacency.get(edge.source)!.push(edge)
  }

  const flowKind = flow.kind ?? "flow"
  const entryNodeType = flowKind === "subflow" ? "input" : "trigger"
  const entryNodes = flow.nodes.filter((n) => n.type === entryNodeType)

  if (entryNodes.length === 0) {
    if (flow.nodes.length === 0) {
      return { context, nodeResults, status: "completed" }
    }
    throw new Error(`Flow "${flow.name}" has no ${entryNodeType} node`)
  }

  for (const entryNode of entryNodes) {
    const result = await executeNode(
      entryNode.id,
      nodeMap,
      adjacency,
      context,
      nodeResults,
      new Set(),
      triggerData,
      1,
      options?.run_id,
      options?.lifecycle,
      options?.signal,
    )

    if (result.status === "waiting") {
      return {
        context,
        nodeResults,
        status: "waiting",
        waitingNodeId: result.waitingNodeId,
      }
    }

    if (result.status === "error") {
      return {
        context,
        nodeResults,
        status: "error",
        error: result.error,
      }
    }
  }

  return { context, nodeResults, status: "completed" }
}

async function executeNodeOnly(
  nodeId: string,
  nodeMap: Map<string, FlowNode>,
  context: FlowContext,
  nodeResults: Map<string, NodeExecutorResult>,
  input: Record<string, unknown>,
  run_id?: string,
  lifecycle?: NodeLifecycle,
  signal?: AbortSignal,
): Promise<NodeExecutorResult> {
  if (signal?.aborted) {
    throw new Error("Run cancelled")
  }

  const node = nodeMap.get(nodeId)
  if (!node) return { output: {} }

  const executor = resolveNodeExecutor(node.type, node.data)
  if (!executor) return { output: {} }

  const started_at = Date.now()

  if (run_id && lifecycle?.onNodeStarted) {
    await lifecycle.onNodeStarted({
      run_id,
      node_id: nodeId,
      input,
      attempts: 1,
      started_at,
    })
  }

  const result = await executor(node.data, input, context, nodeId)

  nodeResults.set(nodeId, result)
  setNodeOutput(context, nodeId, result.output)

  if (run_id && lifecycle?.onNodeCompleted) {
    await lifecycle.onNodeCompleted({
      run_id,
      node_id: nodeId,
      input,
      output: result.output,
      attempts: 1,
      started_at,
      completed_at: Date.now(),
    })
  }

  return result
}

async function executeNode(
  nodeId: string,
  nodeMap: Map<string, FlowNode>,
  adjacency: Map<string, FlowEdge[]>,
  context: FlowContext,
  nodeResults: Map<string, NodeExecutorResult>,
  visited: Set<string>,
  input: Record<string, unknown> = {},
  attempt: number = 1,
  run_id?: string,
  lifecycle?: NodeLifecycle,
  signal?: AbortSignal,
): Promise<{ status: "completed" | "waiting" | "error"; waitingNodeId?: string; error?: string }> {
  if (signal?.aborted) {
    return { status: "error", error: "Run cancelled" }
  }

  if (visited.has(nodeId) && attempt === 1) {
    const node = nodeMap.get(nodeId)
    if (!node || node.type !== "join") return { status: "completed" }
  }
  if (attempt === 1) visited.add(nodeId)

  const node = nodeMap.get(nodeId)
  if (!node) return { status: "completed" }

  const executor = resolveNodeExecutor(node.type, node.data)
  if (!executor) {
    return { status: "error", error: `Unknown node type: ${node.type}` }
  }

  const started_at = Date.now()

  if (run_id && lifecycle?.onNodeStarted) {
    await lifecycle.onNodeStarted({
      run_id,
      node_id: nodeId,
      input,
      attempts: attempt,
      started_at,
    })
  }

  let result: NodeExecutorResult
  try {
    const timeoutMs = node.timeout
    const executorPromise = executor(node.data, input, context, nodeId)

    if (timeoutMs && timeoutMs > 0) {
      result = await Promise.race([
        executorPromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Node "${nodeId}" timed out after ${timeoutMs}ms`)),
            timeoutMs,
          ),
        ),
      ])
    } else {
      result = await executorPromise
    }
  } catch (err) {
    const maxRetries = node.retry_max ?? 0
    if (attempt <= maxRetries) {
      const delay = node.retry_delay ?? 1000
      await new Promise((resolve) => setTimeout(resolve, delay))
      return executeNode(
        nodeId,
        nodeMap,
        adjacency,
        context,
        nodeResults,
        visited,
        input,
        attempt + 1,
        run_id,
        lifecycle,
        signal,
      )
    }
    const error = err instanceof Error ? err.message : String(err)

    if (run_id && lifecycle?.onNodeFailed) {
      await lifecycle.onNodeFailed({
        run_id,
        node_id: nodeId,
        error,
        attempts: attempt,
        started_at,
        completed_at: Date.now(),
      })
    }

    return { status: "error", error }
  }

  nodeResults.set(nodeId, result)
  setNodeOutput(context, nodeId, result.output)

  if (run_id && lifecycle?.onNodeCompleted) {
    await lifecycle.onNodeCompleted({
      run_id,
      node_id: nodeId,
      input,
      output: result.output,
      attempts: attempt,
      started_at,
      completed_at: Date.now(),
    })
  }

  if (result.status === "async") {
    return { status: "waiting", waitingNodeId: nodeId }
  }

  const edges = adjacency.get(nodeId) ?? []
  const nextEdges = filterEdgesByResult(edges, result)

  if (nextEdges.length > 1 && node.type === "fork") {
    const pendingKey = `pending_fork`
    const pendingFork = context.flow_variables[pendingKey] as
      | {
          nodeId: string
          remainingEdges: Array<{ target: string }>
          input: Record<string, unknown>
        }
      | undefined

    let edgesToRun = nextEdges
    if (pendingFork && pendingFork.nodeId === nodeId) {
      edgesToRun = pendingFork.remainingEdges
        .map((e) => nextEdges.find((ne) => ne.target === e.target) ?? e)
        .filter(Boolean) as FlowEdge[]
    }

    const processedTargets = new Set<string>()
    const branchOutputs = new Map<string, Record<string, unknown>>()

    for (const edge of edgesToRun) {
      const nextResult = await executeNodeOnly(
        edge.target,
        nodeMap,
        context,
        nodeResults,
        result.output,
        run_id,
        lifecycle,
        signal,
      )

      processedTargets.add(edge.target)
      branchOutputs.set(edge.target, nextResult.output)

      if (nextResult.status === "async") {
        const remaining = edgesToRun.filter((e) => !processedTargets.has(e.target))
        if (remaining.length > 0) {
          setFlowVariable(context, pendingKey, {
            nodeId,
            remainingEdges: remaining.map((e) => ({ target: e.target })),
            input: result.output,
          })
        } else {
          setFlowVariable(context, pendingKey, undefined)
        }
        return { status: "waiting", waitingNodeId: edge.target }
      }
    }

    setFlowVariable(context, pendingKey, undefined)

    const joinNodes = findJoinNodes(
      edgesToRun.map((e) => e.target),
      adjacency,
    )
    for (const joinNodeId of joinNodes) {
      const joinInput: Record<string, unknown> = {}
      for (const [targetId, output] of branchOutputs) {
        joinInput[targetId] = output
      }

      const joinResult = await executeNodeOnly(
        joinNodeId,
        nodeMap,
        context,
        nodeResults,
        joinInput,
        run_id,
        lifecycle,
        signal,
      )

      if (joinResult.status === "async") {
        return { status: "waiting", waitingNodeId: joinNodeId }
      }
    }

    return { status: "completed" }
  } else {
    for (const edge of nextEdges) {
      const nextResult = await executeNode(
        edge.target,
        nodeMap,
        adjacency,
        context,
        nodeResults,
        visited,
        result.output,
        1,
        run_id,
        lifecycle,
        signal,
      )

      if (nextResult.status === "waiting") {
        return nextResult
      }

      if (nextResult.status === "error") {
        return nextResult
      }
    }
  }

  return { status: "completed" }
}

function findJoinNodes(branchNodeIds: string[], adjacency: Map<string, FlowEdge[]>): string[] {
  const branchSet = new Set(branchNodeIds)

  const incomingByTarget = new Map<string, Set<string>>()
  for (const edges of adjacency.values()) {
    for (const edge of edges) {
      if (!branchSet.has(edge.source)) continue
      if (!incomingByTarget.has(edge.target)) {
        incomingByTarget.set(edge.target, new Set())
      }
      incomingByTarget.get(edge.target)!.add(edge.source)
    }
  }

  const joinNodes: string[] = []
  for (const [targetId, sources] of incomingByTarget) {
    if ([...branchSet].every((s) => sources.has(s))) {
      joinNodes.push(targetId)
    }
  }

  return joinNodes
}

function filterEdgesByResult(edges: FlowEdge[], result: NodeExecutorResult): FlowEdge[] {
  if (!result.followEdges || result.followEdges.length === 0) {
    return edges
  }

  const handles = new Set(result.followEdges.map((e) => e.handle))

  return edges.filter((edge) => {
    const handle = edge.sourceHandle ?? edge.label ?? "output"
    return handles.has(handle)
  })
}

/**
 * Validates that a state transition is allowed for a flow run.
 *
 * Allowed transitions:
 * - pending → running, cancelled
 * - running → waiting, completed, error, cancelled
 * - waiting → running, completed, error, cancelled
 * - completed/error/cancelled → (none, terminal states)
 */
export function validateFlowRunTransition(current: string, target: string): boolean {
  const validTransitions: Record<string, string[]> = {
    pending: ["running", "cancelled"],
    running: ["waiting", "completed", "error", "cancelled"],
    waiting: ["running", "completed", "error", "cancelled"],
    completed: [],
    error: [],
    cancelled: [],
  }

  return validTransitions[current]?.includes(target) ?? false
}

export function hasPendingForks(context: FlowContext): boolean {
  const pendingFork = context.flow_variables["pending_fork"] as
    | { nodeId: string; remainingEdges: Array<{ target: string }>; input: Record<string, unknown> }
    | undefined
  return !!(pendingFork && pendingFork.remainingEdges.length > 0)
}

export interface FlowValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validates a flow's structure:
 * - All edges reference existing nodes
 * - Flow has a trigger node (if it has any nodes)
 * - Flow graph contains no cycles
 */
export function validateFlow(flow: Flow): FlowValidationResult {
  const errors: string[] = []
  const flowKind = flow.kind ?? "flow"
  const nodeIds = new Set(flow.nodes.map((n) => n.id))
  const triggerNodes = flow.nodes.filter((n) => n.type === "trigger")
  const inputNodes = flow.nodes.filter((n) => n.type === "input")
  const outputNodes = flow.nodes.filter((n) => n.type === "output")

  for (const edge of flow.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge "${edge.id}" references non-existent source node "${edge.source}"`)
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge "${edge.id}" references non-existent target node "${edge.target}"`)
    }
  }

  if (flowKind === "flow" && flow.nodes.length > 0) {
    if (triggerNodes.length !== 1) {
      errors.push(`Flow must have exactly one trigger node, got ${triggerNodes.length}`)
    }
    if (inputNodes.length > 0) {
      errors.push("Flow nodes cannot contain input nodes")
    }
    if (outputNodes.length > 0) {
      errors.push("Flow nodes cannot contain output nodes")
    }
  }

  if (flowKind === "subflow") {
    if (triggerNodes.length > 0) {
      errors.push("Subflow cannot contain trigger nodes")
    }
    if (inputNodes.length !== 1) {
      errors.push(`Subflow must have exactly one input node, got ${inputNodes.length}`)
    }
    if (outputNodes.length !== 1) {
      errors.push(`Subflow must have exactly one output node, got ${outputNodes.length}`)
    }
  }

  const adj = new Map<string, string[]>()
  for (const edge of flow.edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      const list = adj.get(edge.source) ?? []
      list.push(edge.target)
      adj.set(edge.source, list)
    }
  }

  const visited = new Set<string>()
  const inStack = new Set<string>()

  function dfs(nodeId: string): boolean {
    if (inStack.has(nodeId)) return true
    if (visited.has(nodeId)) return false
    visited.add(nodeId)
    inStack.add(nodeId)
    for (const next of adj.get(nodeId) ?? []) {
      if (dfs(next)) return true
    }
    inStack.delete(nodeId)
    return false
  }

  for (const nodeId of nodeIds) {
    if (dfs(nodeId)) {
      errors.push(`Flow contains a cycle involving node "${nodeId}"`)
      break
    }
  }

  if (flowKind === "subflow" && inputNodes.length === 1 && outputNodes.length === 1) {
    const reachable = new Set<string>()

    function walk(nodeId: string): void {
      if (reachable.has(nodeId)) return
      reachable.add(nodeId)
      for (const next of adj.get(nodeId) ?? []) {
        walk(next)
      }
    }

    walk(inputNodes[0].id)

    if (!reachable.has(outputNodes[0].id)) {
      errors.push("Subflow must contain a path from input node to output node")
    }
  }

  return { valid: errors.length === 0, errors }
}
