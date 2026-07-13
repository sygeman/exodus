function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function cleanText(text: string): string {
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim()
}

export function formatToolInput(tool: string, input: Record<string, unknown> | undefined): string {
  if (!input) return ""

  if (tool === "edit") {
    const filePath = typeof input.file_path === "string" ? input.file_path : ""
    const oldStr = typeof input.old_string === "string" ? input.old_string : ""
    const newStr = typeof input.new_string === "string" ? input.new_string : ""
    if (!oldStr && !newStr) return ""
    return `\n<div class="tool-diff"><div class="tool-diff-path">${escapeHtml(filePath)}</div><pre class="tool-diff-old">${escapeHtml(oldStr)}</pre><pre class="tool-diff-new">${escapeHtml(newStr)}</pre></div>\n`
  }

  if (tool === "bash") {
    const command = typeof input.command === "string" ? input.command : ""
    if (!command) return ""
    return `\n<div class="tool-bash"><pre>${escapeHtml(command)}</pre></div>\n`
  }

  if (tool === "write") {
    const filePath = typeof input.file_path === "string" ? input.file_path : ""
    const content = typeof input.content === "string" ? input.content : ""
    if (!filePath) return ""
    const preview = content.length > 500 ? content.slice(0, 500) + "\n..." : content
    return `\n<div class="tool-write"><div class="tool-diff-path">${escapeHtml(filePath)}</div><pre class="tool-diff-new">${escapeHtml(preview)}</pre></div>\n`
  }

  if (tool === "view") {
    const filePath = typeof input.file_path === "string" ? input.file_path : ""
    const offset = typeof input.offset === "number" ? input.offset : undefined
    const limit = typeof input.limit === "number" ? input.limit : undefined
    if (!filePath) return ""
    const suffix =
      offset !== undefined || limit !== undefined ? ` (${offset ?? 0}..${limit ?? "end"})` : ""
    return `\n<div class="tool-view"><div class="tool-diff-path">${escapeHtml(filePath)}${suffix}</div></div>\n`
  }

  if (tool === "glob") {
    const pattern = typeof input.pattern === "string" ? input.pattern : ""
    if (!pattern) return ""
    return `\n<div class="tool-glob"><code>${escapeHtml(pattern)}</code></div>\n`
  }

  if (tool === "grep") {
    const pattern = typeof input.pattern === "string" ? input.pattern : ""
    const include = typeof input.include === "string" ? input.include : ""
    if (!pattern) return ""
    const suffix = include ? ` <code>${escapeHtml(include)}</code>` : ""
    return `\n<div class="tool-grep"><code>${escapeHtml(pattern)}</code>${suffix}</div>\n`
  }

  return ""
}

export function extractTextFromParts(
  parts: Array<Record<string, unknown>>,
  showReasoning: boolean,
): string {
  return parts
    .map((p) => {
      if (p.type === "text" && typeof p.text === "string") return cleanText(p.text)

      if (p.type === "reasoning" && typeof p.text === "string" && p.text.trim()) {
        if (!showReasoning) return ""
        return `\n\n<div class="reasoning-block">${p.text}</div>\n`
      }

      if (p.type === "tool") {
        const state = (p.state ?? {}) as Record<string, unknown>
        const tool = typeof p.tool === "string" ? p.tool : "tool"
        const status = state.status
        const input = state.input as Record<string, unknown> | undefined
        const toolBlock = formatToolInput(tool, input)
        if (status === "completed") {
          const output = typeof state.output === "string" ? state.output : ""
          const title = typeof state.title === "string" ? state.title : tool
          return `\n\n**${title}**${toolBlock}\n\`\`\`\n${output.slice(0, 1000)}\n\`\`\`\n`
        }
        if (status === "running") {
          const title = typeof state.title === "string" ? state.title : tool
          return `\n\n**${title}**${toolBlock}\n`
        }
        if (status === "pending") {
          return `\n\n*${tool}...*\n`
        }
        if (status === "error") {
          const error = typeof state.error === "string" ? state.error : "error"
          return `\n\n*${tool}: ${error}*\n`
        }
        return ""
      }

      if (p.type === "agent" && typeof p.name === "string") {
        return `\n\n*Agent: ${p.name}*\n`
      }

      return ""
    })
    .join("")
}
