import { z } from "zod"
import type { itemSchema } from "./schemas"

export type FilterCondition = Record<string, unknown>

export function matchFilter(data: Record<string, unknown>, filter: FilterCondition): boolean {
  for (const [key, condition] of Object.entries(filter)) {
    if (key === "_and" && Array.isArray(condition)) {
      return condition.every((sub: FilterCondition) => matchFilter(data, sub))
    }
    if (key === "_or" && Array.isArray(condition)) {
      return condition.some((sub: FilterCondition) => matchFilter(data, sub))
    }

    const value = data[key]
    if (typeof condition === "object" && condition !== null && !Array.isArray(condition)) {
      for (const [op, expected] of Object.entries(condition)) {
        switch (op) {
          case "_eq":
            if (value !== expected) return false
            break
          case "_neq":
            if (value === expected) return false
            break
          case "_gt":
            if (typeof value !== "number" || typeof expected !== "number" || value <= expected)
              return false
            break
          case "_gte":
            if (typeof value !== "number" || typeof expected !== "number" || value < expected)
              return false
            break
          case "_lt":
            if (typeof value !== "number" || typeof expected !== "number" || value >= expected)
              return false
            break
          case "_lte":
            if (typeof value !== "number" || typeof expected !== "number" || value > expected)
              return false
            break
          case "_contains":
            if (
              typeof value !== "string" ||
              typeof expected !== "string" ||
              !value.includes(expected)
            )
              return false
            break
          case "_starts_with":
            if (
              typeof value !== "string" ||
              typeof expected !== "string" ||
              !value.startsWith(expected)
            )
              return false
            break
          case "_ends_with":
            if (
              typeof value !== "string" ||
              typeof expected !== "string" ||
              !value.endsWith(expected)
            )
              return false
            break
          case "_in":
            if (!Array.isArray(expected) || !expected.includes(value)) return false
            break
          case "_between":
            if (!Array.isArray(expected) || expected.length !== 2) return false
            if (typeof value !== "number" || value < expected[0] || value > expected[1])
              return false
            break
        }
      }
    }
  }
  return true
}

export function sortItems(
  items: z.infer<typeof itemSchema>[],
  sort: string[],
): z.infer<typeof itemSchema>[] {
  return items.toSorted((a, b) => {
    for (const field of sort) {
      const desc = field.startsWith("-")
      const key = desc ? field.slice(1) : field
      const aVal = a.data[key]
      const bVal = b.data[key]

      if (aVal === bVal) continue
      if (aVal === undefined || aVal === null) return desc ? 1 : -1
      if (bVal === undefined || bVal === null) return desc ? -1 : 1

      if (typeof aVal === "number" && typeof bVal === "number") {
        return desc ? bVal - aVal : aVal - bVal
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return desc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal)
      }
      return 0
    }
    return 0
  })
}

export const filterSchema = z.record(z.string(), z.any()).optional()
export const sortSchema = z.array(z.string()).optional()
