import { z } from "zod"
import type { EventoRegistry } from "@/lib/evento/types"

export const schemaRegistry: EventoRegistry = {
  "schema:request": {
    schema: z.object({ name: z.string() }),
  },
  "schema:request:response": {
    schema: z.object({ name: z.string(), schema: z.unknown(), description: z.string().optional() }),
  },
}

export type SchemaEventMap = {
  "schema:request": { name: string }
  "schema:request:response": { name: string; schema: unknown }
}
