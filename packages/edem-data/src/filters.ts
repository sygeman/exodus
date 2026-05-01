import { z } from "zod"
import type { itemSchema } from "./schemas"

export type FilterCondition = Record<string, unknown>

function searchInData(data: Record<string, unknown>, query: string): boolean {
  const lowerQuery = query.toLowerCase()
  for (const value of Object.values(data)) {
    if (typeof value === "string" && value.toLowerCase().includes(lowerQuery)) {
      return true
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      if (searchInData(value as Record<string, unknown>, query)) return true
    }
  }
  return false
}

export function matchFilter(data: Record<string, unknown>, filter: FilterCondition): boolean {
  for (const [key, condition] of Object.entries(filter)) {
    if (key === "_and" && Array.isArray(condition)) {
      if (!condition.every((sub: FilterCondition) => matchFilter(data, sub))) return false
      continue
    }
    if (key === "_or" && Array.isArray(condition)) {
      if (!condition.some((sub: FilterCondition) => matchFilter(data, sub))) return false
      continue
    }
    if (key === "_search" && typeof condition === "string") {
      if (!searchInData(data, condition)) return false
      continue
    }

    const value = data[key]
    if (typeof condition === "object" && condition !== null && !Array.isArray(condition)) {
      for (const [op, expected] of Object.entries(condition)) {
        if (op.startsWith("_")) {
          if (!matchOperator(value, op, expected)) return false
        }
      }
    }
  }
  return true
}

function matchOperator(value: unknown, op: string, expected: unknown): boolean {
  switch (op) {
    case "_eq":
      return value === expected
    case "_neq":
      return value !== expected
    case "_gt":
      return typeof value === "number" && typeof expected === "number" && value > expected
    case "_gte":
      return typeof value === "number" && typeof expected === "number" && value >= expected
    case "_lt":
      return typeof value === "number" && typeof expected === "number" && value < expected
    case "_lte":
      return typeof value === "number" && typeof expected === "number" && value <= expected
    case "_contains":
      return typeof value === "string" && typeof expected === "string" && value.includes(expected)
    case "_starts_with":
      return typeof value === "string" && typeof expected === "string" && value.startsWith(expected)
    case "_ends_with":
      return typeof value === "string" && typeof expected === "string" && value.endsWith(expected)
    case "_in":
      return Array.isArray(expected) && expected.includes(value)
    case "_between":
      if (!Array.isArray(expected) || expected.length !== 2) return false
      return typeof value === "number" && value >= expected[0] && value <= expected[1]
    default:
      return false
  }
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
