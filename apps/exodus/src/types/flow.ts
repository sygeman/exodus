export const NodeType = {
  trigger: "trigger",
  action: "action",
  condition: "condition",
  switch: "switch",
  loop: "loop",
  delay: "delay",
  transform: "transform",
  fork: "fork",
  join: "join",
  subflow: "subflow",
  input: "input",
  output: "output",
} as const

export type NodeType = (typeof NodeType)[keyof typeof NodeType]

export type HandleDef = {
  id: string | null
  type: "source" | "target"
  position: "left" | "right"
  top: string
  label?: string
  icon?: string
  color?: string
}

export type VueFlowNodeData = {
  nodeType: NodeType
  actionType?: string
  label?: string
  config?: Record<string, unknown>
  status?: string
  progress?: number
  error?: string
  testMode?: boolean
  handleLayout?: HandleDef[]
}

export const NODE_LABELS: Record<NodeType, { label: string; icon: string }> = {
  trigger: { label: "Trigger", icon: "i-lucide-play" },
  action: { label: "Action", icon: "i-lucide-zap" },
  condition: { label: "Condition", icon: "i-lucide-git-branch" },
  switch: { label: "Switch", icon: "i-lucide-git-fork" },
  loop: { label: "Loop", icon: "i-lucide-repeat" },
  delay: { label: "Delay", icon: "i-lucide-timer" },
  transform: { label: "Transform", icon: "i-lucide-shuffle" },
  fork: { label: "Fork", icon: "i-lucide-split" },
  join: { label: "Join", icon: "i-lucide-merge" },
  subflow: { label: "Subflow", icon: "i-lucide-workflow" },
  input: { label: "Input", icon: "i-lucide-log-in" },
  output: { label: "Output", icon: "i-lucide-log-out" },
}

const ACTION_ICONS: Record<string, string> = {
  download: "i-lucide-download",
  convert: "i-lucide-file-video",
  extract: "i-lucide-archive",
  find_files: "i-lucide-file-search",
  install: "i-lucide-package",
  delete: "i-lucide-trash",
  copy: "i-lucide-copy",
  move: "i-lucide-folder-input",
  notify: "i-lucide-bell",
  http: "i-lucide-globe",
  script: "i-lucide-terminal",
}

export function getNodeIcon(nodeType: NodeType, actionType?: string): string {
  if (nodeType === "action" && actionType) {
    return ACTION_ICONS[actionType] || NODE_LABELS[nodeType].icon
  }
  if (nodeType === "loop") return "i-lucide-repeat"
  return NODE_LABELS[nodeType].icon
}

type HandleConfigInput = {
  nodeType: NodeType
  config?: Record<string, unknown>
  actionType?: string
}

export function buildHandleLayout(input: HandleConfigInput): HandleDef[] {
  const { nodeType, config } = input

  switch (nodeType) {
    case "trigger":
      return [{ id: null, type: "source", position: "right", top: "50%" }]

    case "input":
      return [{ id: null, type: "source", position: "right", top: "50%" }]

    case "output":
      return [{ id: null, type: "target", position: "left", top: "50%" }]

    case "delay":
      return [{ id: null, type: "source", position: "right", top: "50%" }]

    case "transform":
      return [{ id: "output", type: "source", position: "right", top: "50%" }]

    case "action":
    case "subflow":
      return [
        {
          id: "success",
          type: "source",
          position: "right",
          top: "30%",
          label: "Успех",
          icon: "check",
          color: "success",
        },
        {
          id: "error",
          type: "source",
          position: "right",
          top: "70%",
          label: "Ошибка",
          icon: "x",
          color: "error",
        },
      ]

    case "condition":
      return [
        {
          id: "true",
          type: "source",
          position: "right",
          top: "30%",
          label: "Да (true)",
          icon: "check",
          color: "success",
        },
        {
          id: "false",
          type: "source",
          position: "right",
          top: "70%",
          label: "Нет (false)",
          icon: "x",
          color: "error",
        },
      ]

    case "loop":
      return [
        {
          id: "body",
          type: "source",
          position: "right",
          top: "30%",
          label: "Тело цикла",
          icon: "repeat",
          color: "info",
        },
        {
          id: "exit",
          type: "source",
          position: "right",
          top: "70%",
          label: "Выход из цикла",
          icon: "arrow-right",
          color: "success",
        },
      ]

    case "fork": {
      const branches = (config?.branches as Array<{ id: string; label?: string }>) || [
        { id: "branch1", label: "1" },
        { id: "branch2", label: "2" },
      ]
      return branches.map((b, i) => ({
        id: b.id,
        type: "source" as const,
        position: "right" as const,
        top: `${((i + 1) / (branches.length + 1)) * 100}%`,
        label: b.label || b.id,
        color: "primary" as const,
      }))
    }

    case "switch": {
      const cases = (config?.cases as Array<{ value: string; handle: string; label?: string }>) || [
        { value: "case1", handle: "case1", label: "Case 1" },
        { value: "case2", handle: "case2", label: "Case 2" },
      ]
      const handles: HandleDef[] = cases.map((c, i) => ({
        id: c.handle,
        type: "source",
        position: "right",
        top: `${((i + 1) / (cases.length + 2)) * 100}%`,
        label: c.label || c.value,
        color: "info",
      }))
      handles.push({
        id: "default",
        type: "source",
        position: "right",
        top: `${((cases.length + 1) / (cases.length + 2)) * 100}%`,
        label: "По умолчанию",
        color: "neutral",
      })
      return handles
    }

    case "join": {
      const branches = (config?.branches as Array<{ id: string; label?: string }>) || [
        { id: "branch1", label: "1" },
        { id: "branch2", label: "2" },
      ]
      return branches.map((b, i) => ({
        id: b.id,
        type: "target" as const,
        position: "left" as const,
        top: `${((i + 1) / (branches.length + 1)) * 100}%`,
        label: b.label || b.id,
        color: "info" as const,
      }))
    }

    default:
      return [{ id: null, type: "source", position: "right", top: "50%" }]
  }
}
