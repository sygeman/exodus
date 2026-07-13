export interface MessagePart {
  type: string
  id?: string
  text?: string
  tool?: string
  state?: ToolState
  name?: string
  synthetic?: boolean
}

export interface ToolState {
  status: string
  title?: string
  input?: Record<string, unknown>
  output?: string
  error?: string
}

export interface NormalizedMessage {
  id: string
  role: "user" | "assistant"
  parts: MessagePart[]
  time?: { created?: number; completed?: number }
}

function isValidPart(part: unknown): part is MessagePart {
  return Boolean(
    part && typeof part === "object" && typeof (part as Record<string, unknown>).type === "string",
  )
}

export function normalizeParts(parts: Array<Record<string, unknown>>): MessagePart[] {
  return (parts as unknown[]).filter(isValidPart)
}

export function cleanText(text: string): string {
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim()
}

export function filterVisibleParts(parts: MessagePart[], showReasoning: boolean): MessagePart[] {
  const valid = parts.filter(isValidPart)

  const hasNonSynthetic = valid.some((p) => !p.synthetic)

  return valid.filter((part) => {
    if (part.synthetic && part.type === "text") {
      const text = typeof part.text === "string" ? part.text : ""
      if (text.includes("<system-reminder>")) return false
    }

    if (part.synthetic && hasNonSynthetic) return false

    if (!showReasoning && part.type === "reasoning") return false

    return true
  })
}

export function extractPlainText(parts: MessagePart[]): string {
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => cleanText(p.text!))
    .join("")
}

export function normalizeMessage(raw: {
  info: { id: string; role: string; sessionID: string }
  parts: Array<Record<string, unknown>>
}): NormalizedMessage {
  return {
    id: raw.info.id,
    role: raw.info.role as "user" | "assistant",
    parts: normalizeParts(raw.parts),
    time: (raw.info as Record<string, unknown>).time as
      | { created?: number; completed?: number }
      | undefined,
  }
}
