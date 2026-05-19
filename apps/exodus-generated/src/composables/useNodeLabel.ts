import type { VueFlowNodeData } from "@/types/flow"

const ACTION_LABELS: Record<string, string> = {
  download: "Download",
  convert: "Convert",
  extract: "Extract",
  find_files: "Find Files",
  install: "Install",
  delete: "Delete",
  copy: "Copy",
  move: "Move",
  notify: "Notify",
  http: "HTTP",
  script: "Script",
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Manual",
  scheduled: "Schedule",
  event: "Event",
}

const INTERVAL_LABELS: Record<number, string> = {
  300: "5m",
  900: "15m",
  1800: "30m",
  3600: "1h",
  7200: "2h",
  21600: "6h",
  43200: "12h",
  86400: "24h",
}

export function generateNodeLabel(data: VueFlowNodeData): string {
  const config = data.config || {}

  switch (data.nodeType) {
    case "trigger": {
      const triggerType = config.trigger_type as string
      return TRIGGER_LABELS[triggerType] || "Trigger"
    }
    case "action":
      return ACTION_LABELS[data.actionType || ""] || "Action"
    case "condition":
      return "Condition"
    case "switch":
      return "Switch"
    case "loop":
      return "Loop"
    case "delay":
      return "Delay"
    case "subflow": {
      const templateName = config.template_name as string
      return templateName || "Subflow"
    }
    case "input":
      return "Input"
    case "output":
      return "Output"
    case "transform":
      return "Transform"
    default:
      return "Node"
  }
}

export function generateNodeParams(data: VueFlowNodeData): string | null {
  const config = data.config || {}

  switch (data.nodeType) {
    case "trigger": {
      const triggerType = config.trigger_type as string
      if (triggerType === "scheduled") {
        const interval = config.interval_secs as number
        return INTERVAL_LABELS[interval] || null
      }
      if (triggerType === "event") {
        const event = config.event as string
        return event ? truncate(event, 15) : null
      }
      return null
    }
    case "action": {
      if (data.actionType === "http") {
        return (config.method as string) || null
      }
      if (data.actionType === "convert") {
        const format = config.format as string
        if (!format || format.includes("{{")) return null
        return format.toUpperCase()
      }
      return null
    }
    case "condition": {
      const expression = config.expression as string
      if (!expression || expression.includes("{{")) return null
      return truncate(expression, 15)
    }
    case "delay": {
      const seconds = config.seconds as number
      return seconds ? `${seconds}s` : null
    }
    default:
      return null
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 1) + "…"
}
