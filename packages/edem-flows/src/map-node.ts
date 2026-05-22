import { resolveNestedValue } from "./context"

export type MapNodeMapping = {
  sourcePath: string
  targetPath: string
  kind?: "source" | "literal"
  literal?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toPathSegments(path: string): string[] {
  return path
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "")
}

export function normalizeMapNodeMappings(value: unknown): MapNodeMapping[] {
  if (!Array.isArray(value)) {
    return []
  }

  const mappings: MapNodeMapping[] = []

  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.targetPath !== "string") {
      continue
    }

    if (entry.kind === "literal") {
      mappings.push({
        kind: "literal",
        targetPath: entry.targetPath,
        literal: entry.literal,
        sourcePath: "",
      })
      continue
    }

    if (typeof entry.sourcePath !== "string") {
      continue
    }

    mappings.push({
      kind: "source",
      sourcePath: entry.sourcePath,
      targetPath: entry.targetPath,
    })
  }

  return mappings
}

function setNestedValue(target: Record<string, unknown>, path: string[], value: unknown): void {
  if (path.length === 0) {
    return
  }

  let current: Record<string, unknown> = target

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index]
    const next = current[key]

    if (!isRecord(next)) {
      current[key] = {}
    }

    current = current[key] as Record<string, unknown>
  }

  current[path[path.length - 1]] = value
}

export function buildMapNodeOutput(
  mappingsValue: unknown,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const mappings = normalizeMapNodeMappings(mappingsValue)
  const output: Record<string, unknown> = {}

  for (const mapping of mappings) {
    const targetPath = toPathSegments(mapping.targetPath)
    if (targetPath.length === 0) {
      continue
    }

    const resolvedValue =
      mapping.kind === "literal"
        ? mapping.literal
        : resolveNestedValue(input, toPathSegments(mapping.sourcePath))

    setNestedValue(output, targetPath, resolvedValue)
  }

  return output
}
