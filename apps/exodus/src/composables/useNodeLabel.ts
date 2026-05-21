import {
  DEFAULT_FLOW_TRIGGER,
  getTriggerSourceFromNodeData,
  type VueFlowNodeData,
} from "@/types/flow"

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Manual",
  schedule: "Schedule",
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
  const raw = data as unknown as Record<string, unknown>

  switch (data.nodeType) {
    case "trigger": {
      const trigger = getTriggerSourceFromNodeData(raw) ?? DEFAULT_FLOW_TRIGGER
      return TRIGGER_LABELS[trigger.type] ?? "Trigger"
    }
    case "call": {
      const moduleName = (raw.module as string | undefined) ?? (config.module as string | undefined)
      const procedureName =
        (raw.procedure as string | undefined) ?? (config.procedure as string | undefined)
      return moduleName && procedureName ? `${moduleName}.${procedureName}` : "Call"
    }
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
  const raw = data as unknown as Record<string, unknown>

  switch (data.nodeType) {
    case "trigger": {
      const trigger = getTriggerSourceFromNodeData(raw) ?? DEFAULT_FLOW_TRIGGER
      if (trigger.type === "schedule") {
        if (trigger.every) return trigger.every

        const interval = config.interval_secs as number | undefined
        return interval ? INTERVAL_LABELS[interval] || null : null
      }
      if (trigger.type === "event") {
        return trigger.event ? truncate(trigger.event, 15) : null
      }
      return null
    }
    case "call":
      return null
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
