import type { FieldType } from "./fields"

export function isLocalizedValue(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const entries = Object.entries(value)
  if (entries.length === 0) return false
  return entries.every(([, v]) => typeof v === "string")
}

export function resolveLocalizedValue(value: unknown, locale: string, fallback = "en"): unknown {
  if (!isLocalizedValue(value)) return value
  return value[locale] ?? value[fallback] ?? Object.values(value)[0] ?? null
}

const LOCALIZABLE_TYPES: ReadonlySet<FieldType> = new Set(["string", "text"])

export function resolveLocalizedData(
  data: Record<string, unknown>,
  fieldTypes: Map<string, FieldType>,
  locale: string,
  fallback = "en",
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    const type = fieldTypes.get(key)
    if (type && LOCALIZABLE_TYPES.has(type) && isLocalizedValue(value)) {
      resolved[key] = resolveLocalizedValue(value, locale, fallback)
    } else {
      resolved[key] = value
    }
  }
  return resolved
}
