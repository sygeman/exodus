import { onUnmounted, ref } from "vue"
import type {
  LogicEffect,
  LogicFlowDefinition,
  LogicFlowEdge,
  LogicFlowNode,
  LogicRunInput,
  LogicRunResult,
  ScreenRuntimeContext,
  UseLogicFlowInput,
  UseLogicFlowResult,
} from "./contracts"

export function useLogicFlow(input: UseLogicFlowInput): UseLogicFlowResult {
  const pending = ref(false)
  const error = ref<string | null>(null)
  const timers = new Set<ReturnType<typeof setTimeout>>()

  onUnmounted(() => {
    for (const timer of timers) {
      clearTimeout(timer)
    }
    timers.clear()
  })

  async function run(runInput: LogicRunInput): Promise<LogicRunResult> {
    pending.value = true
    error.value = null

    try {
      const result = await executeFlow(runInput)
      await applyEffects(result.effects, runInput.trigger.event, runInput.context, timers)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      error.value = message
      return {
        status: "error",
        effects: [],
        error: message,
      }
    } finally {
      pending.value = false
    }
  }

  const handlers = Object.fromEntries(
    Object.entries(input.flows).map(([flowId, flow]) => [
      flowId,
      async (event?: unknown, item?: unknown) => {
        await run({
          flow,
          trigger: {
            event,
            item,
            route: input.context.route,
            props: input.context.props,
          },
          context: input.context,
        })
      },
    ]),
  ) as UseLogicFlowResult["handlers"]

  return {
    run,
    handlers,
    pending,
    error,
  }
}

async function executeFlow(input: LogicRunInput): Promise<LogicRunResult> {
  const edges = input.flow.edges ?? []
  const nodesById = new Map(input.flow.nodes.map((node) => [node.id, node]))
  const outputs = new Map<string, unknown>()
  const locals: Record<string, unknown> = {}
  const effects: LogicEffect[] = []

  let currentNode: LogicFlowNode | null =
    input.flow.nodes.find((node) => node.type === "trigger") ?? input.flow.nodes[0] ?? null

  while (currentNode) {
    const step = await executeNode(currentNode, input.context, input, outputs, locals, effects)

    if (step.status === "error") {
      return {
        status: "error",
        effects,
        error: step.error,
      }
    }

    outputs.set(currentNode.id, step.output)

    if (currentNode.type === "output") {
      return {
        status: "completed",
        effects,
        output: step.output,
      }
    }

    if (
      currentNode.type === "guard" &&
      step.handle === "false" &&
      !hasOutgoingHandle(edges, currentNode.id, "false")
    ) {
      return {
        status: "completed",
        effects,
        output: step.output,
      }
    }

    currentNode = getNextNode(currentNode.id, step.handle, input.flow, nodesById, edges)
  }

  return {
    status: "completed",
    effects,
    output: undefined,
  }
}

async function executeNode(
  node: LogicFlowNode,
  screenContext: ScreenRuntimeContext,
  runInput: LogicRunInput,
  outputs: Map<string, unknown>,
  locals: Record<string, unknown>,
  effects: LogicEffect[],
): Promise<{
  status: "completed" | "error"
  output: unknown
  handle?: string
  halt?: boolean
  error?: string
}> {
  const ctx = buildEvaluationContext(screenContext, runInput, outputs, locals)

  switch (node.type) {
    case "trigger":
      return {
        status: "completed",
        output: runInput.trigger,
      }

    case "guard": {
      const condition = Boolean(evaluateTemplateExpression(node.data.condition, ctx))
      const passed = node.data.unless ? !condition : condition
      return {
        status: "completed",
        output: { passed },
        handle: passed ? "true" : "false",
      }
    }

    case "ui:set-state": {
      const value = resolveValue(node.data.value, ctx)
      effects.push({ type: "ui:set-state", state: node.data.state, value })
      return { status: "completed", output: { state: node.data.state, value } }
    }

    case "ui:set-timeout-state": {
      const value = resolveValue(node.data.value, ctx)
      effects.push({
        type: "ui:set-timeout-state",
        state: node.data.state,
        value,
        delay: node.data.delay,
      })
      return {
        status: "completed",
        output: { state: node.data.state, value, delay: node.data.delay },
      }
    }

    case "ui:navigate": {
      const to = resolveToString(node.data.to, ctx)
      effects.push({ type: "ui:navigate", to })
      return { status: "completed", output: { to } }
    }

    case "ui:clipboard-write": {
      const text = resolveToString(node.data.text, ctx)
      effects.push({ type: "ui:clipboard-write", text })
      return { status: "completed", output: { text } }
    }

    case "ui:event": {
      effects.push({
        type: "ui:event",
        stopPropagation: node.data.stopPropagation,
        preventDefault: node.data.preventDefault,
      })
      return { status: "completed", output: node.data }
    }

    case "data:create-item": {
      const data = resolveRecord(node.data.data ?? {}, ctx)
      const result = await screenContext.edem.data.createItem({
        collection_id: node.data.collection,
        data,
      })
      if (node.data.assignTo) {
        locals[node.data.assignTo] = result.id
      }
      return { status: "completed", output: { id: result.id } }
    }

    case "data:update-item": {
      const itemId = resolveToString(node.data.id, ctx)
      const data = resolveRecord(node.data.data, ctx)
      const result = await screenContext.edem.data.updateItem({ item_id: itemId, data })
      return { status: "completed", output: { id: result.id } }
    }

    case "data:delete-item": {
      const itemId = resolveToString(node.data.id, ctx)
      const result = await screenContext.edem.data.deleteItem({ item_id: itemId })
      return { status: "completed", output: result }
    }

    case "data:update-singleton": {
      const data = resolveRecord(node.data.data, ctx)
      const result = await screenContext.edem.data.updateSingleton({
        collection_id: node.data.collection,
        data,
      })
      return { status: "completed", output: { id: result.id } }
    }

    case "domain:invoke": {
      const flowId = resolveToString(node.data.flow, ctx)
      const triggerData = node.data.input ? resolveRecord(node.data.input, ctx) : {}
      const result = await screenContext.edem.flows.runFlow({
        flow_id: flowId,
        trigger_data: triggerData,
      })
      return { status: "completed", output: result }
    }

    case "output": {
      const value = resolveValue(node.data?.value, ctx)
      return { status: "completed", output: value }
    }

    default:
      return {
        status: "error",
        output: undefined,
        error: `Unsupported logic node type: ${(node as { type: string }).type}`,
      }
  }
}

function getNextNode(
  nodeId: string,
  handle: string | undefined,
  flow: LogicFlowDefinition,
  nodesById: Map<string, LogicFlowNode>,
  edges: LogicFlowEdge[],
): LogicFlowNode | null {
  if (edges.length > 0) {
    const outgoing = edges.filter((edge) => edge.source === nodeId)
    const edge =
      (handle ? outgoing.find((candidate) => candidate.sourceHandle === handle) : undefined) ??
      outgoing.find((candidate) => candidate.sourceHandle === undefined) ??
      outgoing[0]

    return edge ? (nodesById.get(edge.target) ?? null) : null
  }

  const index = flow.nodes.findIndex((node) => node.id === nodeId)
  return index >= 0 ? (flow.nodes[index + 1] ?? null) : null
}

function buildEvaluationContext(
  screenContext: ScreenRuntimeContext,
  runInput: LogicRunInput,
  outputs: Map<string, unknown>,
  locals: Record<string, unknown>,
): Record<string, unknown> {
  const stateValues = Object.fromEntries(
    Object.entries(screenContext.state).map(([key, value]) => [key, value.value]),
  )
  const queryValues = Object.fromEntries(
    Object.entries(screenContext.queries).map(([key, value]) => [key, value.value]),
  )
  const nodeValues = Object.fromEntries(
    [...outputs.entries()].map(([key, value]) => [
      key,
      {
        output: value,
        ...(value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {}),
      },
    ]),
  )

  return {
    ...screenContext.helpers,
    ...stateValues,
    ...queryValues,
    ...locals,
    route: runInput.trigger.route,
    props: runInput.trigger.props ?? screenContext.props ?? {},
    trigger: {
      event: runInput.trigger.event,
      item: runInput.trigger.item,
      route: runInput.trigger.route,
      props: runInput.trigger.props ?? screenContext.props ?? {},
    },
    context: {
      state: stateValues,
      queries: queryValues,
      helpers: screenContext.helpers ?? {},
      locals,
    },
    nodes: nodeValues,
  }
}

function hasOutgoingHandle(edges: LogicFlowEdge[], nodeId: string, handle: string): boolean {
  return edges.some((edge) => edge.source === nodeId && edge.sourceHandle === handle)
}

async function applyEffects(
  effects: LogicEffect[],
  event: unknown,
  context: ScreenRuntimeContext,
  timers: Set<ReturnType<typeof setTimeout>>,
): Promise<void> {
  for (const effect of effects) {
    switch (effect.type) {
      case "ui:set-state": {
        const target = context.state[effect.state]
        if (target) {
          target.value = effect.value
        }
        break
      }

      case "ui:set-timeout-state": {
        const target = context.state[effect.state]
        if (target) {
          const timer = setTimeout(() => {
            target.value = effect.value
            timers.delete(timer)
          }, effect.delay)
          timers.add(timer)
        }
        break
      }

      case "ui:navigate": {
        if (effect.to === "back") {
          context.router.back()
        } else if (effect.to === "forward") {
          context.router.forward()
        } else {
          await context.router.push(effect.to)
        }
        break
      }

      case "ui:clipboard-write": {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(effect.text)
        }
        break
      }

      case "ui:event": {
        if (event && typeof event === "object") {
          const domEvent = event as { stopPropagation?: () => void; preventDefault?: () => void }
          if (effect.stopPropagation) {
            domEvent.stopPropagation?.()
          }
          if (effect.preventDefault) {
            domEvent.preventDefault?.()
          }
        }
        break
      }
    }
  }
}

function resolveRecord(
  value: Record<string, unknown>,
  context: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, resolveValue(entry, context)]),
  )
}

function resolveValue(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    return resolveTemplate(value, context)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => resolveValue(entry, context))
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, resolveValue(entry, context)]),
    )
  }

  return value
}

function resolveToString(value: unknown, context: Record<string, unknown>): string {
  const resolved = resolveValue(value, context)
  return typeof resolved === "string" ? resolved : String(resolved ?? "")
}

function resolveTemplate(template: string, context: Record<string, unknown>): unknown {
  const exact = template.match(/^\s*\{\{\s*(.+?)\s*\}\}\s*$/)
  if (exact) {
    return evaluateTemplateExpression(exact[1], context)
  }

  if (!template.includes("{{")) {
    return template
  }

  return template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_match, expr: string) => {
    const value = evaluateTemplateExpression(expr, context)
    return value === null || value === undefined ? "" : String(value)
  })
}

function evaluateTemplateExpression(expr: string, context: Record<string, unknown>): unknown {
  const evaluator = new Function("ctx", `with (ctx) { return (${expr}) }`) as (
    ctx: Record<string, unknown>,
  ) => unknown
  return evaluator(context)
}
