import { z } from "zod"

const dayEnum = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])

export const triggerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("event"),
    event: z.string(),
    filter: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("schedule"),
    every: z.string(),
    at: z.string().optional(),
    days: z.array(dayEnum).optional(),
  }),
  z.object({
    type: z.literal("manual"),
  }),
  z.object({
    type: z.literal("webhook"),
    path: z.string(),
  }),
])

export type ScheduleTrigger = z.infer<typeof triggerSchema> & { type: "schedule" }
export type DayOfWeek = z.infer<typeof dayEnum>

const EVERY_RE = /^(\d+)(m|h|d|w)$/

export function parseEvery(every: string): number {
  const match = EVERY_RE.exec(every)
  if (!match) throw new Error(`Invalid every format: "${every}". Expected: Nm, Nh, Nd, Nw`)
  const n = Number(match[1])
  const unit = match[2]
  switch (unit) {
    case "m":
      return n * 60 * 1000
    case "h":
      return n * 60 * 60 * 1000
    case "d":
      return n * 24 * 60 * 60 * 1000
    case "w":
      return n * 7 * 24 * 60 * 60 * 1000
    default:
      throw new Error(`Unknown unit: ${unit}`)
  }
}

const DAY_MAP: Record<DayOfWeek, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 0,
}

export function matchesSchedule(trigger: ScheduleTrigger, now: Date): boolean {
  if (trigger.days && trigger.days.length > 0) {
    const dayNum = now.getDay()
    const allowed = trigger.days.some((d) => DAY_MAP[d] === dayNum)
    if (!allowed) return false
  }

  if (trigger.at) {
    const [h, m] = trigger.at.split(":").map(Number)
    if (now.getHours() !== h || now.getMinutes() !== m) return false
  }

  return true
}

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
