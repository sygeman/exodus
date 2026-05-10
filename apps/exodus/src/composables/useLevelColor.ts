export const LEVEL_COLORS: Record<string, string> = {
  L0: "#8b5cf6",
  L1: "#3b82f6",
  L2: "#10b981",
  L3: "#f59e0b",
  L4: "#f97316",
}

export function getLevelColor(level?: string | null): string {
  return LEVEL_COLORS[level ?? ""] ?? "#9ca3af"
}
