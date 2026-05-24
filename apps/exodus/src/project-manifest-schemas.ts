import { z } from "zod"

export const fieldTypes = [
  "string",
  "text",
  "number",
  "boolean",
  "date",
  "datetime",
  "json",
  "file",
  "image",
  "video",
  "relation",
  "collection",
  "uuid",
  "timestamp",
  "user",
  "sort",
] as const

export type FieldType = (typeof fieldTypes)[number]

export const labelsSchema = z.record(z.string(), z.string())

export const relationFieldSchema = z.object({
  collection: z.string(),
})

function getRelationCollection(relation: unknown, options: unknown): string | undefined {
  if (typeof relation === "object" && relation !== null && "collection" in relation) {
    const collection = (relation as { collection?: unknown }).collection
    if (typeof collection === "string" && collection.trim() !== "") {
      return collection
    }
  }

  if (typeof options === "object" && options !== null && !Array.isArray(options)) {
    const record = options as Record<string, unknown>

    if (typeof record.collection === "string" && record.collection.trim() !== "") {
      return record.collection
    }

    if (
      typeof record.target_collection_id === "string" &&
      record.target_collection_id.trim() !== ""
    ) {
      return record.target_collection_id
    }
  }

  return undefined
}

const baseManifestFieldShape = {
  name: z.string(),
  labels: labelsSchema.optional(),
  type: z.enum(fieldTypes),
  relation: relationFieldSchema.optional(),
  required: z.boolean().optional(),
  default: z.any().optional(),
  options: z.record(z.string(), z.any()).optional(),
  meta: z.record(z.string(), z.any()).optional(),
}

function validateRelationField(
  value: { type: FieldType; relation?: { collection: string }; options?: Record<string, unknown> },
  ctx: z.RefinementCtx,
) {
  if (value.type !== "relation") {
    return
  }

  if (getRelationCollection(value.relation, value.options)) {
    return
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["relation", "collection"],
    message: "Relation field must define a target collection",
  })
}

export const manifestFieldInputSchema = z.object(baseManifestFieldShape)

export const manifestFieldSchema = manifestFieldInputSchema.superRefine(validateRelationField)

export const manifestCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  labels: labelsSchema.optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  singleton: z.boolean().optional(),
  fields: z.array(manifestFieldSchema),
})

export const dataManifestSchema = z.object({
  collections: z.array(manifestCollectionSchema),
})

export type ManifestField = z.infer<typeof manifestFieldSchema>
export type ManifestCollection = z.infer<typeof manifestCollectionSchema>
export type DataManifest = z.infer<typeof dataManifestSchema>
export type RelationField = z.infer<typeof relationFieldSchema>

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

export type FlowEvent = { flow: string; input?: Record<string, unknown> }
export type ActionEvent = { action: string; collection?: string; data?: Record<string, unknown> }
export type NavigateEvent = { navigate: string }
export type ExpressionEvent = { expression: string }
export type EventBinding = FlowEvent | ActionEvent | NavigateEvent | ExpressionEvent

export interface ModelBinding {
  value: unknown
  onChange?: EventBinding
}

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

export interface ComponentNode {
  component: string
  props?: Record<string, unknown>
  children?: ComponentNode[] | string | Translation
  events?: Record<string, EventBinding>
  model?: ModelBinding
  bind?: DataBinding
  if?: string
  elseIf?: string
  else?: boolean
  link?: string
  modal?: {
    vModel: string
    title?: string | Translation
    description?: string | Translation
    footer?: ComponentNode[]
  }
  teleport?: string
  transition?: {
    enterActiveClass?: string
    enterFromClass?: string
    enterToClass?: string
    leaveActiveClass?: string
    leaveFromClass?: string
    leaveToClass?: string
  }
  namedSlots?: Record<string, ComponentNode[]>
  skeleton?: boolean
  empty?: {
    icon?: string
    text?: string | Translation
    action?: ComponentNode
  }
  queries?: Record<string, ManifestQuery>
  state?: Record<string, unknown>
  constants?: Record<string, unknown>
  computed?: Record<string, string>
  flows?: Record<string, unknown>
  actions?: Record<string, ManifestAction>
}

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

const translationSchema = z.object({ $type: z.literal("translation") }).catchall(z.string())

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

const flowEventSchema = z.object({
  flow: z.string(),
  input: z.record(z.string(), z.unknown()).optional(),
})

const actionEventSchema = z.object({
  action: z.string(),
  collection: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

const navigateEventSchema = z.object({
  navigate: z.string(),
})

const expressionEventSchema = z.object({
  expression: z.string(),
})

const eventBindingSchema: z.ZodType<EventBinding> = z.union([
  flowEventSchema,
  actionEventSchema,
  navigateEventSchema,
  expressionEventSchema,
])

const modelBindingSchema: z.ZodType<ModelBinding> = z.lazy(
  () =>
    z.object({
      value: z.any(),
      onChange: eventBindingSchema.optional(),
    }) as z.ZodType<ModelBinding>,
)

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

const dataBindingSchema: z.ZodType<DataBinding> = z.lazy(
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

export const componentNodeSchema: z.ZodType<ComponentNode> = z.lazy(
  () =>
    z.object({
      component: z.string(),
      props: z.record(z.string(), z.any()).optional(),
      children: z.union([z.array(componentNodeSchema), z.string(), translationSchema]).optional(),
      events: z.record(z.string(), eventBindingSchema).optional(),
      model: modelBindingSchema.optional(),
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
      flows: z.record(z.string(), z.unknown()).optional(),
      actions: z.record(z.string(), manifestActionSchema).optional(),
    }) as z.ZodType<ComponentNode>,
)

const routeSchema: z.ZodType<Route> = z.lazy(
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
