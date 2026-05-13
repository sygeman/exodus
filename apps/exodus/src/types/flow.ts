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

export type VueFlowNodeData = {
  nodeType: NodeType
  actionType?: string
  label?: string
  config?: Record<string, unknown>
  status?: string
  progress?: number
  error?: string
  testMode?: boolean
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
