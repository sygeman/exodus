import { z } from "zod"
import { createRegistry } from "@exodus/evento"

export const schemaRegistry = createRegistry("schema", {
  request: {
    schema: z.object({ name: z.string() }),
    response: z.object({ name: z.string(), schema: z.unknown() }),
  },
})

export type SchemaEventMap = {
  "schema:request": { name: string }
  "schema:request:response": { name: string; schema: unknown }
}
