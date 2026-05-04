import { z } from "zod"
import { fieldSchema } from "./fields"

export const collectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  fields: z.array(fieldSchema),
  meta: z.record(z.string(), z.any()).optional(),
})

export const itemSchema = z.object({
  id: z.string(),
  collection_id: z.string(),
  data: z.record(z.string(), z.any()),
  created_at: z.number(),
  updated_at: z.number(),
})
