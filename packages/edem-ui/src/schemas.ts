import { z } from "zod"

// ── Types (manual, to break circular lazy inference) ──────────────────────────

export interface Translation {
  $type: "translation"
  [lang: string]: string
}

export interface ComponentQuery {
  kind?: "collection"
  collection: string
  filter?: Record<string, unknown>
  sort?: string[]
  mode?: "list" | "first"
}

export interface SingletonQuery {
  kind: "singleton"
  collection: string
}

export type ManifestQuery = ComponentQuery | SingletonQuery

/**
 * Transitional component-local action model.
 *
 * Target architecture moves screen behavior into flow manifests and keeps
 * `actions` only as a migration layer while existing manifests are being moved
 * to `event -> flow` bindings.
 */
export type ManifestActionStep =
  | { type: "guard"; condition: string; unless?: boolean }
  | { type: "set-state"; state: string; value: unknown }
  | { type: "set-timeout-state"; state: string; value: unknown; delay: number }
  | { type: "create-item"; collection: string; data?: Record<string, unknown>; assignTo?: string }
  | { type: "update-item"; collection: string; id: string; data: Record<string, unknown> }
  | { type: "delete-item"; collection: string; id: string }
  | { type: "update-singleton"; collection: string; data: Record<string, unknown> }
  | { type: "navigate"; to: string }
  | { type: "clipboard-write"; text: string }
  | { type: "event"; stopPropagation?: boolean; preventDefault?: boolean }

export interface ManifestAction {
  steps: ManifestActionStep[]
}

export interface ComponentNode {
  component: string
  props?: Record<string, unknown>
  children?: ComponentNode[] | string | Translation
  events?: Record<string, EventBinding>
  bind?: DataBinding

  // ── Extended fields (codegen) ──────────────────────────────────────────────
  /** v-if condition: "{{ expr }}" */
  if?: string
  /** v-else-if condition: "{{ expr }}" */
  elseIf?: string
  /** v-else marker */
  else?: boolean
  /** Render as RouterLink with :to binding */
  link?: string
  /** Wrap in UModal — vModel controls open state */
  modal?: {
    vModel: string
    title?: string | Translation
    description?: string | Translation
    footer?: ComponentNode[]
  }
  /** Wrap in <Teleport to="..."> */
  teleport?: string
  /** Transition classes */
  transition?: {
    enterActiveClass?: string
    enterFromClass?: string
    enterToClass?: string
    leaveActiveClass?: string
    leaveFromClass?: string
    leaveToClass?: string
  }
  /** Named slots — key = slot name, value = node tree */
  namedSlots?: Record<string, ComponentNode[]>
  /** Skeleton loader shown while loading is true */
  skeleton?: boolean
  /** Empty state shown when collection is empty */
  empty?: {
    icon?: string
    text?: string | Translation
    action?: ComponentNode
  }
  queries?: Record<string, ManifestQuery>
  state?: Record<string, unknown>
  constants?: Record<string, unknown>
  computed?: Record<string, string>
  /**
   * @deprecated Target architecture moves screen behavior to flow manifests.
   * Keep for migration while existing component manifests are converted from
   * component-local actions to `event -> flow` bindings.
   */
  actions?: Record<string, ManifestAction>
}

export interface DataBinding {
  collection?: string
  items?: unknown[] | string
  filter?: Record<string, unknown>
  sort?: string[]
  key?: string
  alias?: string
  target?: "container" | "item"
  item?: ComponentNode
}

export type FlowEvent = { flow: string; input?: Record<string, unknown> }
/**
 * @deprecated Transitional event form. Prefer `flow` bindings and move CRUD
 * behavior into UI flows instead of binding events directly to ad-hoc actions.
 */
export type ActionEvent = { action: string; collection?: string; data?: Record<string, unknown> }
/**
 * @deprecated Transitional event form. Prefer navigation as a UI flow effect.
 */
export type NavigateEvent = { navigate: string }
export type ExpressionEvent = { expression: string }
/**
 * Target event model is `event -> flow`.
 *
 * `action` and `navigate` remain here only for backward compatibility with the
 * current manifest set during migration.
 */
export type EventBinding = FlowEvent | ActionEvent | NavigateEvent | ExpressionEvent

export interface Route {
  path: string
  root?: string
  redirect?: string
  children?: Route[]
}

export interface RoutesManifest {
  routes: Route[]
  components: Record<string, ComponentNode>
}

// ── Schemas ───────────────────────────────────────────────────────────────────

export const flowEventSchema = z.object({
  flow: z.string(),
  input: z.record(z.string(), z.unknown()).optional(),
})

// Transitional schemas kept for backward compatibility while manifests migrate
// toward the target `event -> flow` contract.
export const actionEventSchema = z.object({
  action: z.string(),
  collection: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

export const navigateEventSchema = z.object({
  navigate: z.string(),
})

export const expressionEventSchema = z.object({
  expression: z.string(),
})

export const eventBindingSchema = z.union([
  flowEventSchema,
  actionEventSchema,
  navigateEventSchema,
  expressionEventSchema,
])

const manifestQuerySchema: z.ZodType<ManifestQuery> = z.union([
  z.object({
    kind: z.literal("singleton"),
    collection: z.string(),
  }),
  z.object({
    kind: z.literal("collection").optional(),
    collection: z.string(),
    filter: z.record(z.string(), z.any()).optional(),
    sort: z.array(z.string()).optional(),
    mode: z.enum(["list", "first"]).optional(),
  }),
])

const manifestActionStepSchema: z.ZodType<ManifestActionStep> = z.union([
  z.object({
    type: z.literal("guard"),
    condition: z.string(),
    unless: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("set-state"),
    state: z.string(),
    value: z.any(),
  }),
  z.object({
    type: z.literal("set-timeout-state"),
    state: z.string(),
    value: z.any(),
    delay: z.number(),
  }),
  z.object({
    type: z.literal("create-item"),
    collection: z.string(),
    data: z.record(z.string(), z.any()).optional(),
    assignTo: z.string().optional(),
  }),
  z.object({
    type: z.literal("update-item"),
    collection: z.string(),
    id: z.string(),
    data: z.record(z.string(), z.any()),
  }),
  z.object({
    type: z.literal("delete-item"),
    collection: z.string(),
    id: z.string(),
  }),
  z.object({
    type: z.literal("update-singleton"),
    collection: z.string(),
    data: z.record(z.string(), z.any()),
  }),
  z.object({
    type: z.literal("navigate"),
    to: z.string(),
  }),
  z.object({
    type: z.literal("clipboard-write"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("event"),
    stopPropagation: z.boolean().optional(),
    preventDefault: z.boolean().optional(),
  }),
])

const manifestActionSchema: z.ZodType<ManifestAction> = z.object({
  steps: z.array(manifestActionStepSchema),
})

export const dataBindingSchema: z.ZodType<DataBinding> = z.lazy(
  () =>
    z.object({
      collection: z.string().optional(),
      items: z.union([z.array(z.any()), z.string()]).optional(),
      filter: z.record(z.string(), z.any()).optional(),
      sort: z.array(z.string()).optional(),
      key: z.string().optional(),
      alias: z.string().optional(),
      target: z.enum(["container", "item"]).optional(),
      item: componentNodeSchema.optional(),
    }) as z.ZodType<DataBinding>,
)

const translationSchema = z.object({ $type: z.literal("translation") }).catchall(z.string())

export const componentNodeSchema: z.ZodType<ComponentNode> = z.lazy(
  () =>
    z.object({
      component: z.string(),
      props: z.record(z.string(), z.any()).optional(),
      children: z.union([z.array(componentNodeSchema), z.string(), translationSchema]).optional(),
      events: z.record(z.string(), eventBindingSchema).optional(),
      bind: dataBindingSchema.optional(),
      if: z.string().optional(),
      elseIf: z.string().optional(),
      else: z.boolean().optional(),
      link: z.string().optional(),
      modal: z
        .object({
          vModel: z.string(),
          title: z.union([z.string(), translationSchema]).optional(),
          description: z.union([z.string(), translationSchema]).optional(),
          footer: z.array(componentNodeSchema).optional(),
        })
        .optional(),
      teleport: z.string().optional(),
      transition: z
        .object({
          enterActiveClass: z.string().optional(),
          enterFromClass: z.string().optional(),
          enterToClass: z.string().optional(),
          leaveActiveClass: z.string().optional(),
          leaveFromClass: z.string().optional(),
          leaveToClass: z.string().optional(),
        })
        .optional(),
      namedSlots: z.record(z.string(), z.array(componentNodeSchema)).optional(),
      skeleton: z.boolean().optional(),
      empty: z
        .object({
          icon: z.string().optional(),
          text: z.union([z.string(), translationSchema]).optional(),
          action: componentNodeSchema.optional(),
        })
        .optional(),
      queries: z.record(z.string(), manifestQuerySchema).optional(),
      state: z.record(z.string(), z.any()).optional(),
      constants: z.record(z.string(), z.any()).optional(),
      computed: z.record(z.string(), z.string()).optional(),
      actions: z.record(z.string(), manifestActionSchema).optional(),
    }) as z.ZodType<ComponentNode>,
)

export const routeSchema: z.ZodType<Route> = z.lazy(
  () =>
    z.object({
      path: z.string(),
      root: z.string().optional(),
      redirect: z.string().optional(),
      children: z.array(routeSchema).optional(),
    }) as z.ZodType<Route>,
)

export const routesManifestSchema = z.object({
  routes: z.array(routeSchema),
  components: z.record(z.string(), componentNodeSchema),
})
