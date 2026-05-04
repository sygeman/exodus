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

export const fieldSchema = z.object({
  id: z.string(),
  collection_id: z.string(),
  name: z.string(),
  type: z.enum(fieldTypes),
  options: z.record(z.string(), z.any()).optional(),
  required: z.boolean().optional(),
  default: z.any().optional(),
  meta: z.record(z.string(), z.any()).optional(),
})

export const fieldInputSchema = fieldSchema.omit({ id: true, collection_id: true })

export const manifestFieldSchema = z.object({
  name: z.string(),
  type: z.enum(fieldTypes),
  required: z.boolean().optional(),
  default: z.any().optional(),
  options: z.record(z.string(), z.any()).optional(),
  meta: z.record(z.string(), z.any()).optional(),
})

export const manifestCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  singleton: z.boolean().optional(),
  fields: z.array(manifestFieldSchema),
})

export const manifestSchema = z.object({
  collections: z.array(manifestCollectionSchema),
})

export type Manifest = z.infer<typeof manifestSchema>
export type ManifestCollection = z.infer<typeof manifestCollectionSchema>
export type ManifestField = z.infer<typeof manifestFieldSchema>

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/
const isoDatetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

export function validateFieldValue(type: FieldType, value: unknown): boolean {
  if (value === null || value === undefined) return true

  switch (type) {
    case "string":
    case "text":
    case "file":
    case "image":
    case "video":
    case "user":
      return typeof value === "string"
    case "number":
    case "sort":
      return typeof value === "number"
    case "boolean":
      return typeof value === "boolean"
    case "date":
      return typeof value === "string" && isoDateRegex.test(value)
    case "datetime":
    case "timestamp":
      return typeof value === "string" && isoDatetimeRegex.test(value)
    case "json":
      return typeof value === "object" || Array.isArray(value)
    case "uuid":
      return (
        typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
      )
    case "relation":
      return typeof value === "string"
    case "collection":
      return true
    default:
      return false
  }
}
