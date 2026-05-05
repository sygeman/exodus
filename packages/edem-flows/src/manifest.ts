import { z } from "zod"

export const triggerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("event"),
    event: z.string(),
    filter: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("schedule"),
    cron: z.string(),
  }),
  z.object({
    type: z.literal("manual"),
  }),
  z.object({
    type: z.literal("webhook"),
    path: z.string(),
  }),
])

export const nodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.string(), z.unknown()).optional(),
  retry_max: z.number().optional(),
  retry_delay: z.number().optional(),
  timeout: z.number().optional(),
})

export const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  condition: z.string().optional(),
  label: z.string().optional(),
})

export const flowManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  trigger: triggerSchema,
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  meta: z.record(z.string(), z.unknown()).optional(),
})

export const flowsManifestSchema = z.object({
  flows: z.array(flowManifestSchema),
})

export type FlowManifest = z.infer<typeof flowManifestSchema>
export type FlowsManifest = z.infer<typeof flowsManifestSchema>
