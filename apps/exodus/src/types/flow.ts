export const NodeType = {
  trigger: "trigger",
  call: "call",
  map: "map",
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

export const FlowKind = {
  flow: "flow",
  subflow: "subflow",
} as const

export type FlowKind = (typeof FlowKind)[keyof typeof FlowKind]

export type ScheduleDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

export type FlowTrigger =
  | { type: "manual" }
  | { type: "event"; event: string; filter?: Record<string, unknown> }
  | { type: "schedule"; every: string; at?: string; days?: ScheduleDay[] }

const SCHEDULE_EVERY_RE = /^(\d+)(m|h|d|w)$/
const SCHEDULE_TIME_RE = /^(\d{2}):(\d{2})$/
const SCHEDULE_DAYS = new Set<ScheduleDay>(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])

export type StoredFlowNode = {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export type StoredFlowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
}

export type FlowValidationResult = {
  valid: boolean
  errors: string[]
}

export const DEFAULT_FLOW_TRIGGER: FlowTrigger = { type: "manual" }

export function getFlowKind(value: unknown): FlowKind {
  return value === FlowKind.subflow ? FlowKind.subflow : FlowKind.flow
}

export function createDefaultFlowShape(kind: FlowKind): {
  nodes: StoredFlowNode[]
  edges: StoredFlowEdge[]
} {
  if (kind === FlowKind.subflow) {
    return {
      nodes: [
        {
          id: "input",
          type: NodeType.input,
          position: { x: 160, y: 120 },
          data: { nodeType: NodeType.input, label: "Input" },
        },
        {
          id: "output",
          type: NodeType.output,
          position: { x: 480, y: 120 },
          data: { nodeType: NodeType.output, label: "Output", outputs: {} },
        },
      ],
      edges: [{ id: "input-output", source: "input", target: "output" }],
    }
  }

  return {
    nodes: [
      {
        id: "trigger",
        type: NodeType.trigger,
        position: { x: 160, y: 120 },
        data: {
          nodeType: NodeType.trigger,
          label: "Trigger",
          source: DEFAULT_FLOW_TRIGGER,
        },
      },
    ],
    edges: [],
  }
}

export function isProtectedNode(kind: FlowKind, node: { type: string }): boolean {
  if (kind === FlowKind.subflow) {
    return node.type === NodeType.input || node.type === NodeType.output
  }

  return node.type === NodeType.trigger
}

export function getAllowedNodeTypes(kind: FlowKind): NodeType[] {
  if (kind === FlowKind.subflow) {
    return [
      NodeType.call,
      NodeType.map,
      NodeType.condition,
      NodeType.switch,
      NodeType.loop,
      NodeType.delay,
      NodeType.transform,
      NodeType.fork,
      NodeType.join,
      NodeType.subflow,
    ]
  }

  return [
    NodeType.call,
    NodeType.map,
    NodeType.condition,
    NodeType.switch,
    NodeType.loop,
    NodeType.delay,
    NodeType.transform,
    NodeType.fork,
    NodeType.join,
    NodeType.subflow,
  ]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseTriggerSource(value: unknown): FlowTrigger | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null
  }

  switch (value.type) {
    case "event":
      return typeof value.event === "string"
        ? {
            type: "event",
            event: value.event,
            filter: isRecord(value.filter) ? value.filter : undefined,
          }
        : null
    case "schedule":
      return typeof value.every === "string"
        ? {
            type: "schedule",
            every: value.every,
            at: typeof value.at === "string" ? value.at : undefined,
            days: Array.isArray(value.days)
              ? value.days.filter(
                  (day): day is ScheduleDay =>
                    typeof day === "string" && SCHEDULE_DAYS.has(day as ScheduleDay),
                )
              : undefined,
          }
        : null
    case "manual":
      return { type: "manual" }
    default:
      return null
  }
}

export function getTriggerSourceFromNodeData(value: unknown): FlowTrigger | null {
  const data = isRecord(value) ? value : {}
  return parseTriggerSource(data.source)
}

export function getTriggerNodeData(
  trigger: FlowTrigger | null | undefined,
): Record<string, unknown> {
  const nextTrigger = trigger ?? DEFAULT_FLOW_TRIGGER
  return {
    nodeType: NodeType.trigger,
    source: nextTrigger,
  }
}

export function deriveTriggerFromNodes(
  kind: FlowKind,
  nodes: StoredFlowNode[],
): FlowTrigger | null {
  if (kind === FlowKind.subflow) return null

  const triggerNode = nodes.find((node) => node.type === NodeType.trigger)
  return getTriggerSourceFromNodeData(triggerNode?.data)
}

export function validateTriggerSource(trigger: FlowTrigger | null | undefined): string[] {
  const nextTrigger = trigger ?? DEFAULT_FLOW_TRIGGER

  switch (nextTrigger.type) {
    case "event":
      return nextTrigger.event.trim() === "" ? ["Trigger event source must not be empty"] : []
    case "schedule": {
      const errors: string[] = []

      if (!SCHEDULE_EVERY_RE.test(nextTrigger.every)) {
        errors.push(`Schedule trigger has invalid every value "${nextTrigger.every}"`)
      }

      if (nextTrigger.at) {
        const match = SCHEDULE_TIME_RE.exec(nextTrigger.at)
        if (!match) {
          errors.push(`Schedule trigger has invalid at value "${nextTrigger.at}"`)
        } else {
          const hours = Number(match[1])
          const minutes = Number(match[2])
          if (hours > 23 || minutes > 59) {
            errors.push(`Schedule trigger has invalid at value "${nextTrigger.at}"`)
          }
        }
      }

      if (nextTrigger.days?.some((day) => !SCHEDULE_DAYS.has(day))) {
        errors.push("Schedule trigger contains unsupported day values")
      }

      return errors
    }
    case "manual":
    default:
      return []
  }
}

export function validateFlowGraph(input: {
  kind: FlowKind
  nodes: StoredFlowNode[]
  edges: StoredFlowEdge[]
}): FlowValidationResult {
  const errors: string[] = []
  const nodeIds = new Set(input.nodes.map((node) => node.id))
  const triggerNodes = input.nodes.filter((node) => node.type === NodeType.trigger)
  const inputNodes = input.nodes.filter((node) => node.type === NodeType.input)
  const outputNodes = input.nodes.filter((node) => node.type === NodeType.output)

  for (const edge of input.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge "${edge.id}" references non-existent source node "${edge.source}"`)
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge "${edge.id}" references non-existent target node "${edge.target}"`)
    }
  }

  const adjacency = new Map<string, string[]>()
  for (const edge of input.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    const list = adjacency.get(edge.source) ?? []
    list.push(edge.target)
    adjacency.set(edge.source, list)
  }

  if (input.kind === FlowKind.flow && input.nodes.length > 0) {
    if (triggerNodes.length !== 1) {
      errors.push(`Flow must have exactly one trigger node, got ${triggerNodes.length}`)
    }
    if (inputNodes.length > 0) {
      errors.push("Flow nodes cannot contain input nodes")
    }
    if (outputNodes.length > 0) {
      errors.push("Flow nodes cannot contain output nodes")
    }
  } else if (input.kind === FlowKind.subflow) {
    if (triggerNodes.length > 0) {
      errors.push("Subflow cannot contain trigger nodes")
    }
    if (inputNodes.length !== 1) {
      errors.push(`Subflow must have exactly one input node, got ${inputNodes.length}`)
    }
    if (outputNodes.length !== 1) {
      errors.push(`Subflow must have exactly one output node, got ${outputNodes.length}`)
    }
  }

  const visited = new Set<string>()
  const inStack = new Set<string>()

  function dfs(nodeId: string): boolean {
    if (inStack.has(nodeId)) return true
    if (visited.has(nodeId)) return false
    visited.add(nodeId)
    inStack.add(nodeId)
    for (const next of adjacency.get(nodeId) ?? []) {
      if (dfs(next)) return true
    }
    inStack.delete(nodeId)
    return false
  }

  for (const nodeId of nodeIds) {
    if (dfs(nodeId)) {
      errors.push(`Flow contains a cycle involving node "${nodeId}"`)
      break
    }
  }

  if (input.kind === FlowKind.subflow && inputNodes.length === 1 && outputNodes.length === 1) {
    const reachable = new Set<string>()

    function walk(nodeId: string): void {
      if (reachable.has(nodeId)) return
      reachable.add(nodeId)
      for (const next of adjacency.get(nodeId) ?? []) {
        walk(next)
      }
    }

    walk(inputNodes[0].id)

    if (!reachable.has(outputNodes[0].id)) {
      errors.push("Subflow must contain a path from input node to output node")
    }
  }

  return { valid: errors.length === 0, errors }
}

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
  call: { label: "Call", icon: "i-lucide-zap" },
  map: { label: "Map", icon: "i-lucide-waypoints" },
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

export function getNodeIcon(nodeType: NodeType): string {
  if (nodeType === "loop") return "i-lucide-repeat"
  return NODE_LABELS[nodeType].icon
}

type HandleConfigInput = {
  nodeType: NodeType
  config?: Record<string, unknown>
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

    case "map":
      return [{ id: "output", type: "source", position: "right", top: "50%" }]

    case "call":
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
