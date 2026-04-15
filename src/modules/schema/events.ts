import { z } from "zod"
import type { EventoRegistry } from "@/lib/evento/types"

export const schemaRegistry: EventoRegistry = {
  "evento:schema:request": {
    schema: z.object({ name: z.string() }),
    description: "events.schema.schemaRequest",
  },
  "evento:schema:request:response": {
    schema: z.object({ name: z.string(), schema: z.unknown(), description: z.string().optional() }),
    description: "events.schema.schemaRequestResponse",
  },
}

export type SchemaEventMap = {
  "evento:schema:request": { name: string }
  "evento:schema:request:response": { name: string; schema: unknown; description?: string }
}
