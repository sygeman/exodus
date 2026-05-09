// ── Shared Utilities ───────────────────────────────────────────────────────────
// Used across all stages and parser modules.

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function kebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}

export function camelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

export function slugify(str: string): string {
  return str
    .replace(/\//g, "-")
    .replace(/\{\{\s*(.+?)\s*\}\}/g, "$1")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
}

export function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/</g, "&lt;")
}
