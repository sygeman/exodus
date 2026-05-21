import type { ProcedureCatalogModule } from "@/procedure-catalog"
import { normalizeProjectFlowGraph } from "@/project-flow-normalization"
import {
  NodeType,
  type FlowKind as FlowKindValue,
  type FlowValidationResult,
  type FlowTrigger,
  type StoredFlowEdge,
  type StoredFlowNode,
  validateTriggerSource,
  validateFlowGraph,
} from "@/types/flow"

type ProcedureReference = {
  module: string
  procedure: string
}

function getNodeProcedureReference(node: StoredFlowNode): ProcedureReference | null {
  if (node.type !== NodeType.call) {
    return null
  }

  const moduleName = typeof node.data.module === "string" ? node.data.module : null
  const procedureName = typeof node.data.procedure === "string" ? node.data.procedure : null

  if (!moduleName || !procedureName) {
    return { module: "", procedure: "" }
  }

  return { module: moduleName, procedure: procedureName }
}

function findProcedure(
  catalog: ProcedureCatalogModule[],
  moduleName: string,
  procedureName: string,
) {
  return catalog
    .find((entry) => entry.module === moduleName)
    ?.procedures.find((procedure) => procedure.name === procedureName)
}

function validateProcedureReferences(
  nodes: StoredFlowNode[],
  procedureCatalog: ProcedureCatalogModule[],
): string[] {
  const errors: string[] = []

  for (const node of nodes) {
    const reference = getNodeProcedureReference(node)

    if (node.type === NodeType.call && reference && (!reference.module || !reference.procedure)) {
      errors.push(`Call node "${node.id}" must specify module and procedure`)
      continue
    }

    if (!reference || !reference.module || !reference.procedure) {
      continue
    }

    const procedure = findProcedure(procedureCatalog, reference.module, reference.procedure)
    if (!procedure) {
      errors.push(
        `Node "${node.id}" references unknown procedure "${reference.module}.${reference.procedure}"`,
      )
      continue
    }

    if (procedure.kind === "subscription") {
      errors.push(
        `Node "${node.id}" references subscription "${reference.module}.${reference.procedure}"; use query or mutation`,
      )
    }
  }

  return errors
}

function validateTriggerReference(
  trigger: FlowTrigger | null,
  procedureCatalog: ProcedureCatalogModule[],
): string[] {
  if (!trigger || trigger.type !== "event" || !trigger.event.includes(".")) {
    return []
  }

  const separator = trigger.event.indexOf(".")
  const moduleName = trigger.event.slice(0, separator)
  const procedureName = trigger.event.slice(separator + 1)
  const procedure = findProcedure(procedureCatalog, moduleName, procedureName)

  if (!procedure) {
    return [`Trigger event source references unknown subscription "${trigger.event}"`]
  }

  if (procedure.kind !== "subscription") {
    return [`Trigger event source "${trigger.event}" must reference a subscription`]
  }

  return []
}

export function validateProjectFlow(input: {
  kind: FlowKindValue
  nodes: StoredFlowNode[]
  edges: StoredFlowEdge[]
  procedureCatalog?: ProcedureCatalogModule[]
}): FlowValidationResult {
  const normalized = normalizeProjectFlowGraph({
    kind: input.kind,
    nodes: input.nodes,
    edges: input.edges,
    procedureCatalog: input.procedureCatalog,
  })

  const structural = validateFlowGraph({
    kind: input.kind,
    nodes: normalized.nodes,
    edges: normalized.edges,
  })

  const trigger = normalized.trigger
  const triggerErrors = [
    ...validateTriggerSource(trigger),
    ...validateTriggerReference(trigger, input.procedureCatalog ?? []),
  ]
  const procedureErrors = validateProcedureReferences(
    normalized.nodes,
    input.procedureCatalog ?? [],
  )
  const errors = [...structural.errors, ...triggerErrors, ...procedureErrors]

  return {
    valid: errors.length === 0,
    errors,
  }
}
