import { z } from "zod"

// ── Types (manual, to break circular lazy inference) ──────────────────────────

export interface Translation {
  $type: "translation"
  [lang: string]: string
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
  /** Raw script injected as-is into <script setup> */
  rawScript?: string
}

export interface DataBinding {
  collection?: string
  items?: unknown[] | string
  filter?: Record<string, unknown>
  sort?: string[]
  key?: string
  target?: "container" | "item"
  item?: ComponentNode
}

export type FlowEvent = { flow: string; input?: Record<string, unknown> }
export type ActionEvent = { action: string; collection?: string; data?: Record<string, unknown> }
export type NavigateEvent = { navigate: string }
export type ExpressionEvent = { expression: string }
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

export const dataBindingSchema: z.ZodType<DataBinding> = z.lazy(
  () =>
    z.object({
      collection: z.string().optional(),
      items: z.union([z.array(z.any()), z.string()]).optional(),
      filter: z.record(z.string(), z.any()).optional(),
      sort: z.array(z.string()).optional(),
      key: z.string().optional(),
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
      rawScript: z.string().optional(),
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
