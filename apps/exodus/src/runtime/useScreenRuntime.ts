import { computed, ref } from "vue"
import { renderNode, useT, type RenderContext } from "@exodus/edem-vue"
import { useCollectionQuery, useSingleton } from "@/hooks"
import { useLogicFlow } from "./useLogicFlow"
import type {
  ScreenRuntimeContext,
  UseScreenRuntimeInput,
  UseScreenRuntimeResult,
} from "./contracts"

export function useScreenRuntime(input: UseScreenRuntimeInput): UseScreenRuntimeResult {
  const t = useT()
  const state = Object.fromEntries(
    Object.entries(input.screen.state ?? {}).map(([key, value]) => [key, ref(value)]),
  ) as ScreenRuntimeContext["state"]

  const queries: ScreenRuntimeContext["queries"] = {}
  const collections: RenderContext["collections"] = {}
  const singletons: RenderContext["singletons"] = {}

  for (const [name, query] of Object.entries(input.screen.queries ?? {})) {
    if (query.kind === "singleton") {
      const singleton = useSingleton(query.collection as never)
      queries[name] = singleton.data
      singletons[name] = singleton.data
      state[`${name}Loading`] = singleton.loading
      continue
    }

    const collection = useCollectionQuery(query.collection as never, () => {
      const resolvedFilter = query.filter
        ? (resolveValue(query.filter, state, queries, input.context.route, input.context.props) as
            | Record<string, unknown>
            | undefined)
        : undefined

      return {
        filter: resolvedFilter,
        sort: query.sort,
      }
    })

    queries[name] = collection.data
    collections[name] = collection.data
    state[`${name}Loading`] = collection.loading
    state[`${name}Total`] = collection.total
  }

  for (const [name, expression] of Object.entries(input.screen.computed ?? {})) {
    state[name] = computed(() =>
      resolveValue(expression, state, queries, input.context.route, input.context.props),
    )
  }

  const logicContext: ScreenRuntimeContext = {
    ...input.context,
    state,
    queries,
  }

  const logic = useLogicFlow({
    flows: input.flows,
    context: logicContext,
  })

  const handlers = Object.fromEntries(
    Object.entries(logic.handlers).map(([flowId, handler]) => [
      `flow:${flowId}`,
      async (event?: unknown, item?: unknown) => handler(event, item),
    ]),
  ) as RenderContext["handlers"]

  function renderRoot() {
    return renderNode(input.screen.root, input.registry, {
      route: input.context.route as unknown as RenderContext["route"],
      state,
      collections,
      singletons,
      helpers: input.context.helpers ?? {},
      t,
      handlers,
    })
  }

  return {
    registry: input.registry,
    state,
    queries,
    handlers: logic.handlers,
    renderRoot,
  }
}

function buildContext(
  state: ScreenRuntimeContext["state"],
  queries: ScreenRuntimeContext["queries"],
  route: ScreenRuntimeContext["route"],
  props?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    route,
    props: props ?? {},
    ...Object.fromEntries(Object.entries(state).map(([key, value]) => [key, value.value])),
    ...Object.fromEntries(Object.entries(queries).map(([key, value]) => [key, value.value])),
  }
}

function resolveValue(
  value: unknown,
  state: ScreenRuntimeContext["state"],
  queries: ScreenRuntimeContext["queries"],
  route: ScreenRuntimeContext["route"],
  props?: Record<string, unknown>,
): unknown {
  const context = buildContext(state, queries, route, props)

  if (typeof value === "string") {
    const exact = value.match(/^\s*\{\{\s*(.+?)\s*\}\}\s*$/)
    if (exact) {
      return evaluateExpression(exact[1], context)
    }

    if (!value.includes("{{")) {
      return value
    }

    return value.replace(/\{\{\s*(.+?)\s*\}\}/g, (_match, expr: string) => {
      const resolved = evaluateExpression(expr, context)
      return resolved === null || resolved === undefined ? "" : String(resolved)
    })
  }

  if (Array.isArray(value)) {
    return value.map((entry) => resolveValue(entry, state, queries, route, props))
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        resolveValue(entry, state, queries, route, props),
      ]),
    )
  }

  return value
}

function evaluateExpression(expr: string, context: Record<string, unknown>): unknown {
  const evaluator = new Function("ctx", `with (ctx) { return (${expr}) }`) as (
    ctx: Record<string, unknown>,
  ) => unknown
  return evaluator(context)
}
