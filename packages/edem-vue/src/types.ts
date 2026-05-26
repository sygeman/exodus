import type { InferModuleAPI } from "@exodus/edem-core"
import type { dataModule } from "@exodus/edem-data"

export type EdemData = InferModuleAPI<typeof dataModule>

export interface TypedItem<T = Record<string, unknown>> {
  id: string
  collection_id: string
  data: T
  created_at: number
  updated_at: number
  deleted_at?: number | null
  schema_version?: number | null
  source?: string | null
}

export interface QueryOptions {
  filter?: Record<string, unknown>
  sort?: string[]
  limit?: number
  offset?: number
  locale?: string
}

export interface QueryResult<T = Record<string, unknown>> {
  items: TypedItem<T>[]
  total: number
}

type MapFieldType<T> = T extends
  | "string"
  | "text"
  | "uuid"
  | "datetime"
  | "file"
  | "image"
  | "video"
  ? string
  : T extends "number"
    ? number
    : T extends "boolean"
      ? boolean
      : T extends "json"
        ? unknown
        : unknown

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I,
) => void
  ? I
  : never

type MapField<F> = F extends {
  name: infer N extends string
  type: infer Tp extends string
  required: true
}
  ? { [K in N]: MapFieldType<Tp> }
  : F extends { name: infer N extends string; type: infer Tp extends string }
    ? { [K in N]: MapFieldType<Tp> | null }
    : never

type MapFields<Fields> = Fields extends readonly (infer F)[]
  ? UnionToIntersection<MapField<F>>
  : never

export type InferCollectionMap<T> = T extends { collections: readonly (infer C)[] }
  ? {
      [K in C & { id: string } as K["id"]]: K extends { fields: infer Fields }
        ? MapFields<Fields>
        : never
    }
  : never
