import {
  Fragment,
  h,
  Teleport,
  Transition,
  cloneVNode,
  resolveDynamicComponent,
  type VNode,
  type Component,
  type Ref,
} from "vue"
import type { ComponentNode, Translation, EventBinding, ModelBinding } from "@exodus/edem-ui"
import type { TypedItem } from "./types"

// ── Types ────────────────────────────────────────────────────────────────────

export interface RenderContext {
  route: Record<string, string>
  state: Record<string, Ref<unknown>>
  collections: Record<string, Ref<TypedItem[]>>
  singletons: Record<string, Ref<TypedItem | null>>
  helpers: Record<string, (...args: unknown[]) => unknown>
  t: (messages: Record<string, string>, params?: Record<string, unknown>) => string
  handlers: Record<string, (...args: unknown[]) => void>
}

export type ComponentRegistry = Record<string, Component | string>

// ── Expression Evaluator ─────────────────────────────────────────────────────

const evalCache = new Map<string, (ctx: Record<string, unknown>) => unknown>()

function evalExpr(expr: string, ctx: Record<string, unknown>): unknown {
  let fn = evalCache.get(expr)
  if (!fn) {
    fn = new Function("ctx", `with(ctx) { return (${expr}) }`) as (
      ctx: Record<string, unknown>,
    ) => unknown
    evalCache.set(expr, fn)
  }
  return fn(ctx)
}

function defaultBuildContext(ctx: RenderContext): () => Record<string, unknown> {
  return () => {
    const flat: Record<string, unknown> = {
      route: ctx.route,
      t: ctx.t,
      ...ctx.helpers,
    }

    for (const [key, ref] of Object.entries(ctx.state)) {
      flat[key] = ref.value
    }

    for (const [key, ref] of Object.entries(ctx.collections)) {
      flat[key] = normalizeValue(ref.value)
    }

    for (const [key, ref] of Object.entries(ctx.singletons)) {
      flat[key] = normalizeValue(ref.value)
    }

    return flat
  }
}

// ── Value Resolution ─────────────────────────────────────────────────────────

function isTranslation(value: unknown): value is Translation {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "$type" in value &&
    (value as Record<string, unknown>).$type === "translation"
  )
}

function resolveTranslation(translation: Translation, t: RenderContext["t"]): string {
  const messages: Record<string, string> = {}
  for (const [key, value] of Object.entries(translation)) {
    if (key !== "$type" && typeof value === "string") {
      messages[key] = value
    }
  }
  return t(messages)
}

function resolveValue(
  value: unknown,
  ctx: Record<string, unknown>,
  t: RenderContext["t"],
): unknown {
  if (isTranslation(value)) return resolveTranslation(value, t)
  if (typeof value !== "string") return value
  const exact = value.match(/^\s*\{\{\s*(.+?)\s*\}\}\s*$/)
  if (exact) return evalExpr(exact[1], ctx)
  if (!value.includes("{{")) return value

  return value.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, expr: string) => {
    const result = evalExpr(expr.trim(), ctx)
    return result === undefined || result === null ? "" : String(result)
  })
}

function resolveProps(
  props: Record<string, unknown> | undefined,
  ctx: Record<string, unknown>,
  t: RenderContext["t"],
): Record<string, unknown> | undefined {
  if (!props) return undefined

  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    resolved[key] = resolveValue(value, ctx, t)
  }
  return resolved
}

// ── Children ─────────────────────────────────────────────────────────────────

function resolveChildren(
  children: ComponentNode["children"],
  registry: ComponentRegistry,
  ctx: RenderContext,
  buildContext: () => Record<string, unknown>,
): string | VNode[] | undefined {
  if (children === undefined) return undefined

  if (typeof children === "string") {
    return resolveValue(children, buildContext(), ctx.t) as string
  }

  if (isTranslation(children)) {
    return resolveTranslation(children, ctx.t)
  }

  if (Array.isArray(children)) {
    const nodes: VNode[] = []

    for (let index = 0; index < children.length; index++) {
      const child = children[index]

      if (child.if !== undefined) {
        const chain = [child]
        let cursor = index + 1
        while (cursor < children.length) {
          const next = children[cursor]
          if (next.elseIf !== undefined || next.else === true) {
            chain.push(next)
            cursor++
            continue
          }
          break
        }

        for (const candidate of chain) {
          const rendered = renderNode(candidate, registry, ctx, buildContext)
          if (rendered) {
            nodes.push(rendered)
            break
          }
        }

        index = cursor - 1
        continue
      }

      if (child.elseIf !== undefined || child.else === true) {
        continue
      }

      const rendered = renderNode(child, registry, ctx, buildContext)
      if (rendered) {
        nodes.push(rendered)
      }
    }

    return nodes
  }

  return undefined
}

// ── Conditional ──────────────────────────────────────────────────────────────

function checkConditional(
  node: ComponentNode,
  buildContext: () => Record<string, unknown>,
): "render" | "skip" {
  if (node.if !== undefined) {
    return evalExpr(node.if, buildContext()) ? "render" : "skip"
  }

  if (node.elseIf !== undefined) {
    return evalExpr(node.elseIf, buildContext()) ? "render" : "skip"
  }

  if (node.else === true) {
    return "render"
  }

  return "render"
}

// ── Named Slots ──────────────────────────────────────────────────────────────

function resolveSlots(
  namedSlots: Record<string, ComponentNode[]>,
  registry: ComponentRegistry,
  ctx: RenderContext,
  buildContext: () => Record<string, unknown>,
): Record<string, () => VNode[]> {
  const slots: Record<string, () => VNode[]> = {}
  for (const [name, nodes] of Object.entries(namedSlots)) {
    slots[name] = () =>
      nodes
        .map((node) => renderNode(node, registry, ctx, buildContext))
        .filter((v): v is VNode => v !== null)
  }
  return slots
}

// ── Event Name Mapping ──────────────────────────────────────────────────────

const EVENT_MAP: Record<string, string> = {
  click: "onClick",
  "update:modelValue": "onUpdate:modelValue",
  input: "onInput",
  change: "onChange",
  submit: "onSubmit",
  keydown: "onKeydown",
  keyup: "onKeyup",
  focus: "onFocus",
  blur: "onBlur",
}

function vueEventName(name: string): string {
  return EVENT_MAP[name] ?? `on${name.charAt(0).toUpperCase()}${name.slice(1)}`
}

// ── Main Renderer ────────────────────────────────────────────────────────────

export function renderNode(
  node: ComponentNode,
  registry: ComponentRegistry,
  ctx: RenderContext,
  buildContext?: () => Record<string, unknown>,
): VNode | null {
  const getCtx = buildContext ?? defaultBuildContext(ctx)

  if (node.bind) {
    return renderBoundNode(node, registry, ctx, getCtx)
  }

  // ── Conditional ──────────────────────────────────────────────────────
  if (checkConditional(node, getCtx) === "skip") return null

  if (node.component === "template") {
    const children = resolveChildren(node.children, registry, ctx, getCtx)
    if (typeof children === "string" || children === undefined) return null
    return h(Fragment, null, children)
  }

  if (node.modal) {
    return renderModalNode(node, registry, ctx, getCtx)
  }

  // ── Teleport ─────────────────────────────────────────────────────────
  if (node.teleport) {
    const inner = renderNode({ ...node, teleport: undefined }, registry, ctx, getCtx)
    if (!inner) return null
    return h(Teleport, { to: node.teleport }, inner)
  }

  // ── Transition ───────────────────────────────────────────────────────
  if (node.transition) {
    const t = node.transition
    const props: Record<string, string> = {}
    if (t.enterActiveClass) props["enter-active-class"] = t.enterActiveClass
    if (t.enterFromClass) props["enter-from-class"] = t.enterFromClass
    if (t.enterToClass) props["enter-to-class"] = t.enterToClass
    if (t.leaveActiveClass) props["leave-active-class"] = t.leaveActiveClass
    if (t.leaveFromClass) props["leave-from-class"] = t.leaveFromClass
    if (t.leaveToClass) props["leave-to-class"] = t.leaveToClass

    const inner = renderNode({ ...node, transition: undefined }, registry, ctx, getCtx)
    if (!inner) return null
    return h(Transition, props, () => inner)
  }

  // ── Resolve component ────────────────────────────────────────────────
  const component = registry[node.component] ?? resolveDynamicComponent(node.component)

  // ── Props ────────────────────────────────────────────────────────────
  const evalCtx = getCtx()
  const resolvedProps = resolveProps(node.props, evalCtx, ctx.t)
  const modelProps = resolveModel(node.model, ctx, evalCtx)

  // ── Events ───────────────────────────────────────────────────────────
  const eventHandlers: Record<string, (...args: unknown[]) => void> = {}
  if (node.events) {
    for (const [eventName, binding] of Object.entries(node.events)) {
      eventHandlers[vueEventName(eventName)] = createEventHandler(binding, ctx, getCtx)
    }
  }

  // ── Named slots ──────────────────────────────────────────────────────
  if (node.namedSlots) {
    const slots = resolveSlots(node.namedSlots, registry, ctx, getCtx)
    return h(component, { ...resolvedProps, ...modelProps, ...eventHandlers }, slots)
  }

  // ── Children ─────────────────────────────────────────────────────────
  const children = resolveChildren(node.children, registry, ctx, getCtx)

  return h(component, { ...resolvedProps, ...modelProps, ...eventHandlers }, children)
}

function renderBoundNode(
  node: ComponentNode,
  registry: ComponentRegistry,
  ctx: RenderContext,
  buildContext: () => Record<string, unknown>,
): VNode | null {
  const binding = node.bind
  if (!binding) return null

  const items = resolveBindingItems(binding.items, buildContext())
  const alias = binding.alias ?? "item"
  const rendered = items
    .map((entry, index) => {
      const itemValue = normalizeValue(entry)
      const childContext = () => ({
        ...buildContext(),
        [alias]: itemValue,
        item: itemValue,
        index,
      })
      const childNode = binding.item ?? node
      const vnode = renderNode(
        childNode === node ? { ...node, bind: undefined } : childNode,
        registry,
        ctx,
        childContext,
      )

      if (!vnode) return null

      const resolvedKey = binding.key ? resolveValue(binding.key, childContext(), ctx.t) : index
      const key =
        typeof resolvedKey === "string" ||
        typeof resolvedKey === "number" ||
        typeof resolvedKey === "symbol"
          ? resolvedKey
          : index
      return cloneVNode(vnode, { key })
    })
    .filter((vnode): vnode is VNode => vnode !== null)

  return h(Fragment, null, rendered)
}

function renderModalNode(
  node: ComponentNode,
  registry: ComponentRegistry,
  ctx: RenderContext,
  buildContext: () => Record<string, unknown>,
): VNode | null {
  const modal = node.modal
  if (!modal) return null

  const modalComponent = registry.UModal ?? resolveDynamicComponent("UModal")
  const modalState = ctx.state[modal.vModel]
  const evalCtx = buildContext()
  const props: Record<string, unknown> = {
    open: Boolean(modalState?.value),
    "onUpdate:open": (value: unknown) => {
      if (modalState) {
        modalState.value = Boolean(value)
      }
    },
  }

  if (modal.title !== undefined) {
    props.title = resolveValue(modal.title, evalCtx, ctx.t)
  }

  if (modal.description !== undefined) {
    props.description = resolveValue(modal.description, evalCtx, ctx.t)
  }

  const slots: Record<string, () => unknown> = {}
  const children = resolveChildren(node.children, registry, ctx, buildContext)
  if (children !== undefined) {
    slots.default = () => children
  }

  const footer = modal.footer
  if (footer) {
    slots.footer = () =>
      footer
        .map((entry) => renderNode(entry, registry, ctx, buildContext))
        .filter((entry): entry is VNode => entry !== null)
  }

  return h(modalComponent, props, slots)
}

function resolveModel(
  model: ModelBinding | undefined,
  ctx: RenderContext,
  evalCtx: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!model) {
    return undefined
  }

  const resolved: Record<string, unknown> = {
    modelValue: resolveValue(model.value, evalCtx, ctx.t),
  }

  if (model.onChange) {
    resolved["onUpdate:modelValue"] = createEventHandler(model.onChange, ctx, () => evalCtx)
  }

  return resolved
}

function resolveBindingItems(
  items: NonNullable<ComponentNode["bind"]>["items"],
  ctx: Record<string, unknown>,
): unknown[] {
  if (items === undefined) return []
  if (typeof items === "string") {
    const resolved = evalExpr(items, ctx)
    return Array.isArray(resolved) ? resolved : []
  }
  return items
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry))
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    const data = record.data

    if (data && typeof data === "object" && !Array.isArray(data)) {
      return {
        ...(normalizeValue(data) as Record<string, unknown>),
        ...record,
      }
    }
  }

  return value
}

// ── Event Handlers ───────────────────────────────────────────────────────────

function createEventHandler(
  binding: EventBinding,
  ctx: RenderContext,
  getCtx: () => Record<string, unknown>,
): (...args: unknown[]) => void {
  if ("flow" in binding) {
    return (...args: unknown[]) => {
      const currentCtx = getCtx()
      const currentItem = currentCtx.item
      const event = binding.input
        ? resolveEventHandlerInput(binding.input, args, currentCtx)
        : args[0]
      ctx.handlers[`flow:${binding.flow}`]?.(event, currentItem)
    }
  }

  if ("navigate" in binding) {
    return (...args: unknown[]) => {
      ctx.handlers[`navigate:${binding.navigate}`]?.(...args)
    }
  }

  if ("action" in binding) {
    return (...args: unknown[]) => {
      const key = `action:${binding.action}:${binding.collection ?? ""}`
      ctx.handlers[key]?.(binding.data, ...args)
    }
  }

  return () => {}
}

function resolveEventHandlerInput(
  input: Record<string, unknown>,
  args: unknown[],
  ctx: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.startsWith("{{ ")) {
      const expr = value.slice(3, -2).trim()
      if (expr === "event") {
        resolved[key] = args[0]
      } else {
        resolved[key] = evalExpr(expr, { ...ctx, event: args[0] })
      }
    } else {
      resolved[key] = value
    }
  }
  return resolved
}
