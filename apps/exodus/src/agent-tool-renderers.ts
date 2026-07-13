import type { ToolState } from "./agent-parts"

const BASH_TOOLS = new Set(["bash", "shell", "cmd", "terminal"])
const EDIT_TOOLS = new Set([
  "edit",
  "multiedit",
  "write",
  "apply_patch",
  "str_replace",
  "create",
  "file_write",
])
const READ_TOOLS = new Set(["read", "view", "file_read"])

export function isToolType(
  toolName: string | undefined,
  category: "bash" | "edit" | "read" | "search",
): boolean {
  if (!toolName) return false
  const normalized = toolName.trim().toLowerCase().replace(/:\d+$/, "")
  switch (category) {
    case "bash":
      return BASH_TOOLS.has(normalized)
    case "edit":
      return EDIT_TOOLS.has(normalized)
    case "read":
      return READ_TOOLS.has(normalized)
    case "search":
      return (
        normalized === "glob" ||
        normalized === "grep" ||
        normalized === "find" ||
        normalized === "ripgrep"
      )
    default:
      return false
  }
}

export function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function truncateOutput(output: string, maxLen = 2000): string {
  if (output.length <= maxLen) return output
  return output.slice(0, maxLen) + "\n..."
}

export function parseDiffHunks(diffText: string): Array<{
  header: string
  lines: Array<{ type: "add" | "remove" | "context"; content: string }>
}> {
  const hunks: Array<{
    header: string
    lines: Array<{ type: "add" | "remove" | "context"; content: string }>
  }> = []
  const lines = diffText.split("\n")
  let currentHunk: {
    header: string
    lines: Array<{ type: "add" | "remove" | "context"; content: string }>
  } | null = null

  for (const line of lines) {
    if (line.startsWith("@@")) {
      if (currentHunk) hunks.push(currentHunk)
      currentHunk = { header: line, lines: [] }
    } else if (currentHunk) {
      if (line.startsWith("+")) {
        currentHunk.lines.push({ type: "add", content: line.slice(1) })
      } else if (line.startsWith("-")) {
        currentHunk.lines.push({ type: "remove", content: line.slice(1) })
      } else {
        currentHunk.lines.push({
          type: "context",
          content: line.startsWith(" ") ? line.slice(1) : line,
        })
      }
    }
  }
  if (currentHunk) hunks.push(currentHunk)
  return hunks
}

export function parseReadOutput(output: string): {
  type: "file" | "directory" | "unknown"
  lines: Array<{ lineNum: number | null; text: string }>
} {
  const typeMatch = output.match(/<type>(file|directory)<\/type>/i)
  const detectedType = (typeMatch?.[1]?.toLowerCase() ?? "unknown") as
    | "file"
    | "directory"
    | "unknown"

  const contentMatch = output.match(/<content>([\s\S]*?)<\/content>/i)
  const rawContent = contentMatch?.[1] ?? output
  const rawLines = rawContent.split("\n")

  const lines = rawLines.map((line) => {
    const numberedMatch = line.match(/^(\d+):\s?(.*)$/)
    if (numberedMatch) {
      return { lineNum: Number(numberedMatch[1]), text: numberedMatch[2] }
    }
    return { lineNum: null, text: line }
  })

  return { type: detectedType, lines }
}

export function parseGrepOutput(
  output: string,
): Array<{ file: string; lineNum: string; content: string }> {
  const results: Array<{ file: string; lineNum: string; content: string }> = []
  const lines = output.trim().split("\n").filter(Boolean)

  for (const line of lines) {
    const match = line.match(/^(.+?):(\d+):(.*)$/) || line.match(/^(.+?):(.*)$/)
    if (match) {
      const [, filepath, lineNumOrContent, content] = match
      const lineNum = content !== undefined ? lineNumOrContent : ""
      const actualContent = content !== undefined ? content : lineNumOrContent
      results.push({ file: filepath, lineNum, content: actualContent })
    }
  }

  return results
}

export function parseGlobOutput(output: string): Array<{ dir: string; files: string[] }> {
  const paths = output.trim().split("\n").filter(Boolean)
  const groups: Record<string, string[]> = {}

  for (const p of paths) {
    const lastSlash = p.lastIndexOf("/")
    const dir = lastSlash > 0 ? p.substring(0, lastSlash) : "/"
    const filename = lastSlash >= 0 ? p.substring(lastSlash + 1) : p
    if (!groups[dir]) groups[dir] = []
    groups[dir].push(filename)
  }

  return Object.entries(groups)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([dir, files]) => ({ dir, files: files.toSorted() }))
}

export function parseDirectoryOutput(
  output: string,
): Array<{ name: string; depth: number; isFile: boolean }> {
  const items: Array<{ name: string; depth: number; isFile: boolean }> = []
  const lines = output.trim().split("\n").filter(Boolean)

  for (const line of lines) {
    const match = line.match(/^(\s*)(.+)$/)
    if (match) {
      const [, spaces, name] = match
      const depth = Math.floor(spaces.length / 2)
      const isFile = !name.endsWith("/")
      items.push({ name: name.replace(/\/$/, ""), depth, isFile })
    }
  }

  return items
}

export function getToolCategory(
  toolName: string | undefined,
): "bash" | "edit" | "read" | "search" | "other" {
  if (!toolName) return "other"
  if (isToolType(toolName, "bash")) return "bash"
  if (isToolType(toolName, "edit")) return "edit"
  if (isToolType(toolName, "read")) return "read"
  if (isToolType(toolName, "search")) return "search"
  return "other"
}

export function getToolTitle(state: ToolState, toolName: string): string {
  return state.title || toolName
}
