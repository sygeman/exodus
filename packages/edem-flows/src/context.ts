export interface FlowContext {
  trigger_data: Record<string, unknown>
  node_outputs: Record<string, Record<string, unknown>>
  flow_variables: Record<string, unknown>
}

export function createContext(trigger_data: Record<string, unknown> = {}): FlowContext {
  return {
    trigger_data,
    node_outputs: {},
    flow_variables: {},
  }
}

export function setNodeOutput(
  context: FlowContext,
  nodeId: string,
  output: Record<string, unknown>,
): void {
  context.node_outputs[nodeId] = output
}

export function setFlowVariable(context: FlowContext, key: string, value: unknown): void {
  context.flow_variables[key] = value
}

export function resolveTemplate(template: string, context: FlowContext): unknown {
  const regex = /\{\{([^}]+)\}\}/g
  const matches = [...template.matchAll(regex)]

  if (matches.length === 0) return template

  if (matches.length === 1 && matches[0][0] === template.trim()) {
    return resolveVariable(matches[0][1].trim(), context)
  }

  return template.replace(regex, (_, path) => {
    const value = resolveVariable(path.trim(), context)
    if (value === undefined || value === null) return ""
    if (typeof value === "object") return JSON.stringify(value)
    return String(value)
  })
}

export function resolveVariable(path: string, context: FlowContext): unknown {
  const parts = path.split(".")
  if (parts.length === 0) return undefined

  const scope = parts[0]
  const rest = parts.slice(1)

  switch (scope) {
    case "trigger":
      return resolveNestedValue(context.trigger_data, rest)
    case "nodes": {
      if (rest.length === 0) return undefined
      const nodeId = rest[0]
      const nodeOutput = context.node_outputs[nodeId]
      if (!nodeOutput) return undefined
      // Support both nodes.id.field and nodes.id.output.field
      if (rest.length >= 2 && rest[1] === "output") {
        return resolveNestedValue(nodeOutput, rest.slice(2))
      }
      return resolveNestedValue(nodeOutput, rest.slice(1))
    }
    case "context": {
      if (rest.length === 0) return undefined
      const varName = rest[0]
      return context.flow_variables[varName]
    }
    default:
      return undefined
  }
}

export function resolveNestedValue(value: unknown, path: string[]): unknown {
  let current = value

  for (const key of path) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== "object") return undefined

    if (Array.isArray(current)) {
      const index = parseInt(key, 10)
      if (isNaN(index)) return undefined
      current = current[index]
    } else {
      current = (current as Record<string, unknown>)[key]
    }
  }

  return current
}

export function resolveNodeInput(
  config: Record<string, unknown> | undefined,
  context: FlowContext,
): Record<string, unknown> {
  if (!config) return {}

  const resolved: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string") {
      resolved[key] = resolveTemplate(value, context)
    } else {
      resolved[key] = value
    }
  }

  return resolved
}
