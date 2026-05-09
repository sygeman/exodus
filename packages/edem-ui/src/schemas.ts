import { z } from "zod"

// ── Types (manual, to break circular lazy inference) ──────────────────────────

export interface ComponentNode {
  component: string
  props?: Record<string, unknown>
  children?: ComponentNode[] | string
  events?: Record<string, EventBinding>
  bind?: DataBinding
}

export interface DataBinding {
  collection?: string
  items?: unknown[] | string
  filter?: Record<string, unknown>
  sort?: string[]
  item?: ComponentNode
}

export type FlowEvent = { flow: string; input?: Record<string, unknown> }
export type ActionEvent = { action: string; collection?: string; data?: Record<string, unknown> }
export type NavigateEvent = { navigate: string }
export type EventBinding = FlowEvent | ActionEvent | NavigateEvent

export interface Route {
  path: string
  root?: string
  redirect?: string
}

export interface UIManifest {
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

export const eventBindingSchema = z.union([flowEventSchema, actionEventSchema, navigateEventSchema])

export const dataBindingSchema: z.ZodType<DataBinding> = z.lazy(
  () =>
    z.object({
      collection: z.string().optional(),
      items: z.union([z.array(z.any()), z.string()]).optional(),
      filter: z.record(z.string(), z.any()).optional(),
      sort: z.array(z.string()).optional(),
      item: componentNodeSchema.optional(),
    }) as z.ZodType<DataBinding>,
)

export const componentNodeSchema: z.ZodType<ComponentNode> = z.lazy(
  () =>
    z.object({
      component: z.string(),
      props: z.record(z.string(), z.any()).optional(),
      children: z.union([z.array(componentNodeSchema), z.string()]).optional(),
      events: z.record(z.string(), eventBindingSchema).optional(),
      bind: dataBindingSchema.optional(),
    }) as z.ZodType<ComponentNode>,
)

export const routeSchema = z.object({
  path: z.string(),
  root: z.string().optional(),
  redirect: z.string().optional(),
})

export const uiManifestSchema = z.object({
  routes: z.array(routeSchema),
  components: z.record(z.string(), componentNodeSchema),
})
