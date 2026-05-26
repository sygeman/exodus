import { normalizeProjectFlowGraph } from "./project-flow-normalization"
import type {
  DataManifest as ProjectDataManifest,
  ManifestCollection,
  ManifestField,
} from "./project-manifest-schemas"
import type {
  ProcedureCatalogModule,
  ProcedureCatalogProcedure,
  ProcedureCatalogSchemaDescriptor,
} from "./procedure-catalog"
import {
  DEFAULT_FLOW_TRIGGER,
  getFlowKind,
  getTriggerSourceFromNodeData,
  NodeType,
  type StoredFlowEdge,
  type StoredFlowNode,
} from "./types/flow"

type NodeData = Record<string, unknown>

type FlowNodeLike = {
  id: string
  type: string
  data: NodeData
}

type GraphNodeLike = {
  id: string
  type: string
  data: NodeData
}

type GraphEdgeLike = {
  source: string
  target: string
}

type FlowSourceItem = {
  id: string
  data: {
    name?: string
    kind?: unknown
    nodes?: unknown
    edges?: unknown
    valid?: unknown
    validation_errors?: unknown
  }
}

export type NodeContractField = {
  name: string
  type: string
  required: boolean | null
  enumValues: string[]
  constraints: string[]
  children: NodeContractField[]
  note: string | null
}

export type NodeContractSchemaSection = {
  note: string | null
  fields: NodeContractField[]
}

export type NodeContractValidationSection = {
  note: string | null
  rules: string[]
}

export type NodeContract = {
  reference: string | null
  input: NodeContractSchemaSection
  output: NodeContractSchemaSection
  validation: NodeContractValidationSection
}

export function buildNodeContract(input: {
  node: FlowNodeLike
  procedureCatalog: ProcedureCatalogModule[]
  projectFlows?: FlowSourceItem[]
  projectDataManifest?: ProjectDataManifest | null
  graphNodes?: GraphNodeLike[]
  graphEdges?: GraphEdgeLike[]
}): NodeContract {
  const nodeType = getNodeType(input.node)

  switch (nodeType) {
    case NodeType.trigger:
      return buildTriggerContract(input.node, input.procedureCatalog)

    case NodeType.call:
      return buildCallContract(input.node, input.procedureCatalog, {
        projectDataManifest: input.projectDataManifest,
        graphNodes: input.graphNodes,
        graphEdges: input.graphEdges,
      })

    case NodeType.condition:
      return {
        reference: null,
        input: payloadSection("Reads the current payload from the previous node."),
        output: schemaSection(null, [field("result", "boolean", true)]),
        validation: validationSection(
          "Chooses the true or false branch.",
          compact([
            maybeRule("Field", input.node.data.field),
            maybeRule("Operator", input.node.data.operator ?? "eq"),
            maybeRule("Value", input.node.data.value),
            maybeRule("Expression", input.node.data.expression),
          ]),
        ),
      }

    case NodeType.switch:
      return {
        reference: null,
        input: payloadSection("Reads the current payload before branch selection."),
        output: schemaSection(null, [
          field("matched_handle", "text", true),
          field("value", "text", true),
        ]),
        validation: validationSection(
          "Chooses the matching case handle.",
          compact([maybeRule("Value expression", input.node.data.value)]),
        ),
      }

    case NodeType.loop:
      return {
        reference: null,
        input: payloadSection("Receives the current payload for each iteration."),
        output: schemaSection(null, [
          field("status", "string", true, [], [], null, ["completed", "pending"]),
          field("iteration", "number", false),
          field("iterations", "number", false),
          field("results", "array", false),
          field("final", "boolean", false),
        ]),
        validation: validationSection(
          "Loop behavior depends on configured source, limits, and optional procedure.",
          compact([
            maybeRule("Source", input.node.data.source),
            maybeRule("Max iterations", input.node.data.maxIterations),
            maybeProcedureRule(input.node.data.module, input.node.data.procedure),
          ]),
        ),
      }

    case NodeType.delay:
      return {
        reference: null,
        input: payloadSection("Keeps the payload intact and pauses the flow."),
        output: schemaSection(null, [
          field("status", "string", true, [], [], null, ["pending", "completed"]),
          field("delayed_seconds", "number", true),
          field("resume_at", "number", true),
        ]),
        validation: validationSection("Delay must be a positive number of seconds.", [
          `Configured seconds: ${formatValue(input.node.data.seconds ?? 1)}`,
        ]),
      }

    case NodeType.transform:
      return {
        reference: null,
        input: payloadSection("Reads the current payload and computes a derived value."),
        output: schemaSection(null, [field("result", "data", true)]),
        validation: validationSection(
          "Transform rules come from the configured field, operation, or custom code.",
          compact([
            maybeRule("Field", input.node.data.field),
            maybeRule("Operation", input.node.data.operation),
            maybeRule("Value", input.node.data.value),
            maybeRule(
              "Code",
              typeof input.node.data.code === "string"
                ? truncateValue(input.node.data.code, 120)
                : null,
            ),
          ]),
        ),
      }

    case NodeType.fork:
      return {
        reference: null,
        input: payloadSection("Copies the current payload into each outgoing branch."),
        output: schemaSection(null, [
          field("status", "string", true, [], [], null, ["forked"]),
          field("branches", "array", true),
          field("input", "object", true),
        ]),
        validation: validationSection(
          "Available branches are defined on the node handles.",
          buildBranchRules(input.node.data.branches),
        ),
      }

    case NodeType.join:
      return {
        reference: null,
        input: payloadSection("Consumes outputs from upstream branches."),
        output: schemaSection(null, [
          field("status", "string", true, [], [], null, ["completed"]),
          field("mode", "string", true, [], [], null, ["all", "any", "n_of_m"]),
          field("branches", "number", true),
          field("aggregated", "data", true),
        ]),
        validation: validationSection(
          "Aggregation depends on the join mode.",
          compact([
            maybeRule("Mode", input.node.data.mode ?? "all"),
            maybeRule("N", input.node.data.n),
          ]),
        ),
      }

    case NodeType.input:
      return {
        reference: null,
        input: schemaSection("This node is the subflow entry point.", []),
        output: schemaSection("Forwards the parent flow payload as-is.", [
          field("payload", "object", true, [], [], "Parent flow input payload."),
        ]),
        validation: validationSection("No extra node-local validation.", []),
      }

    case NodeType.output:
      return {
        reference: null,
        input: payloadSection("Builds the response from trigger, node, and context values."),
        output: outputMappingSection(input.node.data.outputs, "Subflow response fields."),
        validation: validationSection(
          "Each output field resolves its template at runtime.",
          buildOutputMappingRules(input.node.data.outputs),
        ),
      }

    case NodeType.subflow:
      return buildSubflowContract(input.node, input.procedureCatalog, input.projectFlows ?? [])

    default:
      return {
        reference: null,
        input: schemaSection("This node type does not describe an input schema yet.", []),
        output: schemaSection("This node type does not describe an output schema yet.", []),
        validation: validationSection("No human-readable contract is available yet.", []),
      }
  }
}

function buildTriggerContract(
  node: FlowNodeLike,
  procedureCatalog: ProcedureCatalogModule[],
): NodeContract {
  const trigger = getTriggerSourceFromNodeData(node.data) ?? DEFAULT_FLOW_TRIGGER

  switch (trigger.type) {
    case "event": {
      const [moduleName, procedureName] = trigger.event.split(".")
      const procedure = findProcedure(procedureCatalog, moduleName, procedureName)

      if (!procedure) {
        return {
          reference: trigger.event || null,
          input: schemaSection("Starts the flow from an event subscription.", []),
          output: schemaSection("Choose a valid event source to see the payload fields.", []),
          validation: validationSection(
            "The selected event source is missing from the current procedure catalog.",
            compact([maybeRule("Source", trigger.event)]),
          ),
        }
      }

      return {
        reference: `${moduleName}.${procedureName}`,
        input: schemaSection("Starts the flow from a subscription event.", []),
        output: schemaSectionFromDescriptor(
          procedure.outputSchema,
          "This subscription does not expose payload fields.",
        ),
        validation: validationSection(
          "Event payload is checked against the subscription schema before the flow starts.",
          collectSchemaRulesFromDescriptor(procedure.outputSchema),
        ),
      }
    }

    case "schedule":
      return {
        reference: trigger.every,
        input: schemaSection("Starts the flow from the scheduler.", []),
        output: payloadSection("Forwards the scheduler payload to downstream nodes."),
        validation: validationSection(
          "Schedule timing is defined on the trigger node.",
          compact([
            maybeRule("Every", trigger.every),
            maybeRule("At", trigger.at),
            maybeRule("Days", trigger.days?.join(", ")),
          ]),
        ),
      }

    case "manual":
    default:
      return {
        reference: "manual",
        input: schemaSection("Starts the flow manually.", []),
        output: payloadSection("Forwards the manual trigger payload as-is."),
        validation: validationSection("No static payload rules for manual start.", []),
      }
  }
}

function buildCallContract(
  node: FlowNodeLike,
  procedureCatalog: ProcedureCatalogModule[],
  context: {
    projectDataManifest?: ProjectDataManifest | null
    graphNodes?: GraphNodeLike[]
    graphEdges?: GraphEdgeLike[]
  } = {},
): NodeContract {
  const moduleName = typeof node.data.module === "string" ? node.data.module : ""
  const procedureName = typeof node.data.procedure === "string" ? node.data.procedure : ""

  if (!moduleName || !procedureName) {
    return {
      reference: null,
      input: schemaSection("Select a module and procedure to see the input fields.", []),
      output: schemaSection("Select a module and procedure to see the response fields.", []),
      validation: validationSection(
        "Validation rules are defined by the selected procedure schema.",
        [],
      ),
    }
  }

  const procedure = findProcedure(procedureCatalog, moduleName, procedureName)
  if (!procedure) {
    return {
      reference: `${moduleName}.${procedureName}`,
      input: schemaSection("The selected procedure is not available in the current catalog.", []),
      output: schemaSection("The selected procedure is not available in the current catalog.", []),
      validation: validationSection(
        "Refresh or fix the procedure reference to see the contract.",
        compact([maybeProcedureRule(moduleName, procedureName)]),
      ),
    }
  }

  const baseContract = {
    reference: `${moduleName}.${procedureName}`,
    input: schemaSectionFromDescriptor(
      procedure.inputSchema,
      "This procedure does not take input fields.",
    ),
    output: schemaSectionFromDescriptor(
      procedure.outputSchema,
      "This procedure does not return response fields.",
    ),
    validation: validationSection(
      "Input payload is checked against the procedure schema before execution.",
      collectSchemaRulesFromDescriptor(procedure.inputSchema),
    ),
  }

  if (moduleName !== "data") {
    return baseContract
  }

  return specializeDataProcedureContract({
    baseContract,
    procedureName,
    resolvedCollection: resolveProjectCollectionForCallNode({
      node,
      projectDataManifest: context.projectDataManifest ?? null,
      graphNodes: context.graphNodes ?? [],
      graphEdges: context.graphEdges ?? [],
    }),
  })
}

type ResolvedProjectCollection = {
  collectionId: string | null
  collection: ManifestCollection | null
}

function specializeDataProcedureContract(input: {
  baseContract: NodeContract
  procedureName: string
  resolvedCollection: ResolvedProjectCollection
}): NodeContract {
  if (!isSchemaAwareDataProcedure(input.procedureName)) {
    return input.baseContract
  }

  const { collection } = input.resolvedCollection
  let contract = input.baseContract

  switch (input.procedureName) {
    case "createItem":
    case "updateSingleton":
      if (collection) {
        contract = {
          ...contract,
          input: replaceTopLevelFieldInSection(
            contract.input,
            buildCollectionDataField("data", true, collection, { includeGeneratedFields: false }),
          ),
        }
      }
      break

    case "getSingleton":
      if (collection) {
        contract = {
          ...contract,
          output: replaceTopLevelFieldInSection(
            contract.output,
            buildCollectionItemField("item", true, collection, {
              note: "Can be empty when the singleton item does not exist yet.",
            }),
          ),
        }
      }
      break

    case "queryItems":
    case "searchItems":
    case "getDeletedItems":
      if (collection) {
        contract = {
          ...contract,
          output: replaceTopLevelFieldInSection(
            contract.output,
            buildCollectionItemsField(collection),
          ),
        }
      }
      break
  }

  return appendValidationRules(
    contract,
    buildCollectionSchemaRules(input.procedureName, input.resolvedCollection),
  )
}

function isSchemaAwareDataProcedure(procedureName: string): boolean {
  return (
    procedureName === "createItem" ||
    procedureName === "updateSingleton" ||
    procedureName === "getSingleton" ||
    procedureName === "queryItems" ||
    procedureName === "countItems" ||
    procedureName === "deleteItemsByFilter" ||
    procedureName === "searchItems" ||
    procedureName === "getDeletedItems"
  )
}

function resolveProjectCollectionForCallNode(input: {
  node: FlowNodeLike
  projectDataManifest: ProjectDataManifest | null
  graphNodes: GraphNodeLike[]
  graphEdges: GraphEdgeLike[]
}): ResolvedProjectCollection {
  const collectionId =
    getInlineCollectionId(input.node) ??
    findLiteralStringMappingOnIncomingMap({
      nodeId: input.node.id,
      targetPath: "collection_id",
      graphNodes: input.graphNodes,
      graphEdges: input.graphEdges,
    })

  if (!collectionId) {
    return { collectionId: null, collection: null }
  }

  return {
    collectionId,
    collection:
      input.projectDataManifest?.collections.find((collection) => collection.id === collectionId) ??
      null,
  }
}

function getInlineCollectionId(node: FlowNodeLike): string | null {
  const value = node.data.collection_id
  return typeof value === "string" && value.trim() !== "" ? value : null
}

function findLiteralStringMappingOnIncomingMap(input: {
  nodeId: string
  targetPath: string
  graphNodes: GraphNodeLike[]
  graphEdges: GraphEdgeLike[]
}): string | null {
  for (const edge of input.graphEdges) {
    if (edge.target !== input.nodeId) {
      continue
    }

    const sourceNode = input.graphNodes.find((candidate) => candidate.id === edge.source)
    if (!sourceNode || getNodeType(sourceNode) !== NodeType.map) {
      continue
    }

    const literal = findLiteralStringMappingValue(sourceNode.data.mappings, input.targetPath)
    if (literal) {
      return literal
    }
  }

  return null
}

function findLiteralStringMappingValue(mappings: unknown, targetPath: string): string | null {
  if (!Array.isArray(mappings)) {
    return null
  }

  for (const entry of mappings) {
    if (
      !isRecord(entry) ||
      entry.kind !== "literal" ||
      entry.targetPath !== targetPath ||
      typeof entry.literal !== "string" ||
      entry.literal.trim() === ""
    ) {
      continue
    }

    return entry.literal
  }

  return null
}

function buildCollectionSchemaRules(
  procedureName: string,
  resolvedCollection: ResolvedProjectCollection,
): string[] {
  if (!isSchemaAwareDataProcedure(procedureName)) {
    return []
  }

  if (resolvedCollection.collection) {
    return [`Collection schema: ${resolvedCollection.collection.id}`]
  }

  if (resolvedCollection.collectionId) {
    return [`Collection schema not found in project data: ${resolvedCollection.collectionId}`]
  }

  return ["Collection schema is dynamic until collection_id is fixed in the incoming map."]
}

function buildCollectionDataField(
  name: string,
  required: boolean,
  collection: ManifestCollection,
  options: { includeGeneratedFields?: boolean } = {},
): NodeContractField {
  const fields =
    options.includeGeneratedFields === false
      ? collection.fields.filter((collectionField) => !isGeneratedManifestField(collectionField))
      : collection.fields

  return field(
    name,
    "object",
    required,
    [],
    fields.map((collectionField) => manifestFieldToContractField(collectionField)),
    `Fields from project collection "${collection.id}".`,
  )
}

function isGeneratedManifestField(collectionField: ManifestField): boolean {
  return (
    collectionField.special === "uuid" ||
    collectionField.special === "date-created" ||
    collectionField.special === "date-updated"
  )
}

function buildCollectionItemsField(collection: ManifestCollection): NodeContractField {
  return field(
    "items",
    "array",
    true,
    [],
    buildCollectionItemFields(collection),
    `Each item uses fields from collection "${collection.id}".`,
  )
}

function buildCollectionItemField(
  name: string,
  required: boolean,
  collection: ManifestCollection,
  options: { note?: string | null } = {},
): NodeContractField {
  return field(
    name,
    "object",
    required,
    [],
    buildCollectionItemFields(collection),
    options.note ?? null,
  )
}

function buildCollectionItemFields(collection: ManifestCollection): NodeContractField[] {
  return [
    field("id", "string", true),
    field("collection_id", "string", true, [], [], null, [collection.id]),
    field("schema_version", "number", false),
    field("source", "string", false),
    buildCollectionDataField("data", true, collection),
    field("created_at", "number", true),
    field("updated_at", "number", true),
    field("deleted_at", "number", false),
  ]
}

function manifestFieldToContractField(collectionField: ManifestField): NodeContractField {
  return field(
    collectionField.name,
    collectionField.type,
    collectionField.required === true,
    [],
    [],
    buildManifestFieldNote(collectionField),
    collectManifestFieldEnumValues(collectionField),
  )
}

function buildManifestFieldNote(collectionField: ManifestField): string | null {
  const note = compact([
    buildManifestFieldSpecialNote(collectionField),
    collectionField.relation ? `Target collection: ${collectionField.relation.collection}` : null,
    collectionField.default !== undefined
      ? `Default: ${formatValue(collectionField.default)}`
      : null,
  ])

  return note.length > 0 ? note.join(" · ") : null
}

function buildManifestFieldSpecialNote(collectionField: ManifestField): string | null {
  switch (collectionField.special) {
    case "uuid":
      return "Generated UUID"
    case "date-created":
      return "Generated on create"
    case "date-updated":
      return "Updated automatically"
    default:
      return null
  }
}

function collectManifestFieldEnumValues(collectionField: ManifestField): string[] {
  const items = collectionField.options?.items
  if (!Array.isArray(items)) {
    return []
  }

  return unique(
    items.map((item) =>
      typeof item === "string" || typeof item === "number" || typeof item === "boolean"
        ? String(item)
        : "",
    ),
  )
}

function replaceTopLevelFieldInSection(
  section: NodeContractSchemaSection,
  replacement: NodeContractField,
): NodeContractSchemaSection {
  return {
    ...section,
    fields: replaceTopLevelField(section.fields, replacement),
  }
}

function replaceTopLevelField(
  fields: NodeContractField[],
  replacement: NodeContractField,
): NodeContractField[] {
  const index = fields.findIndex((candidate) => candidate.name === replacement.name)
  if (index === -1) {
    return [...fields, replacement]
  }

  return fields.map((candidate, candidateIndex) =>
    candidateIndex === index ? replacement : candidate,
  )
}

function appendValidationRules(contract: NodeContract, rules: string[]): NodeContract {
  if (rules.length === 0) {
    return contract
  }

  return {
    ...contract,
    validation: {
      ...contract.validation,
      rules: unique([...contract.validation.rules, ...rules]),
    },
  }
}

function buildSubflowContract(
  node: FlowNodeLike,
  procedureCatalog: ProcedureCatalogModule[],
  projectFlows: FlowSourceItem[],
): NodeContract {
  const flowId = typeof node.data.flow_id === "string" ? node.data.flow_id : ""

  if (!flowId) {
    return {
      reference: null,
      input: payloadSection("Forwards the current payload into the child flow."),
      output: schemaSection("Select a target subflow to see its output fields.", []),
      validation: validationSection("Choose a valid subflow target.", []),
    }
  }

  const targetFlow = projectFlows.find((flow) => flow.id === flowId)
  if (!targetFlow) {
    return {
      reference: flowId,
      input: payloadSection("Forwards the current payload into the child flow."),
      output: schemaSection("The referenced subflow was not found in this project.", []),
      validation: validationSection("The node points to a missing subflow.", [
        `Flow ID: ${flowId}`,
      ]),
    }
  }

  const kind = getFlowKind(targetFlow.data.kind)
  const nodes = Array.isArray(targetFlow.data.nodes)
    ? (targetFlow.data.nodes as StoredFlowNode[])
    : []
  const edges = Array.isArray(targetFlow.data.edges)
    ? (targetFlow.data.edges as StoredFlowEdge[])
    : []
  const normalized = normalizeProjectFlowGraph({ kind, nodes, edges, procedureCatalog })
  const outputNode = normalized.nodes.find((entry) => entry.type === NodeType.output)
  const validationErrors = Array.isArray(targetFlow.data.validation_errors)
    ? targetFlow.data.validation_errors.filter(
        (value): value is string => typeof value === "string",
      )
    : []

  const validationRules = compact([`Flow ID: ${flowId}`, `Kind: ${kind}`, ...validationErrors])

  return {
    reference: targetFlow.data.name || flowId,
    input: payloadSection("Forwards the current payload into the child flow."),
    output: outputNode
      ? outputMappingSection(outputNode.data.outputs, "Fields returned from the child flow.")
      : schemaSection("The child flow has no output node fields yet.", []),
    validation:
      kind !== "subflow"
        ? validationSection('The target flow must have kind "subflow".', validationRules)
        : targetFlow.data.valid === false
          ? validationSection("The child flow currently fails validation.", validationRules)
          : validationSection(
              "The child flow is resolved and can expose its output fields here.",
              validationRules,
            ),
  }
}

function schemaSectionFromDescriptor(
  descriptor: ProcedureCatalogSchemaDescriptor,
  emptyNote: string,
): NodeContractSchemaSection {
  if (descriptor.mode === "none") {
    return schemaSection(emptyNote, [])
  }

  const fields = fieldsFromRootSchema(descriptor.schema)
  if (fields.length > 0) {
    return schemaSection(null, fields)
  }

  return schemaSection(describeSchemaFallback(descriptor.schema), [])
}

function collectSchemaRulesFromDescriptor(descriptor: ProcedureCatalogSchemaDescriptor): string[] {
  if (descriptor.mode === "none") {
    return []
  }

  return collectSchemaRules(descriptor.schema)
}

function fieldsFromRootSchema(schema: unknown): NodeContractField[] {
  if (!isRecord(schema)) {
    return []
  }

  const objectVariant = findObjectVariant(schema)
  if (objectVariant) {
    const propertyFields = propertyFieldsFromObject(objectVariant)
    if (propertyFields.length > 0) {
      return propertyFields
    }
  }

  const arrayVariant = findArrayVariant(schema)
  if (arrayVariant) {
    return [
      field(
        "items",
        describeFieldType(arrayVariant),
        null,
        collectFieldConstraints(arrayVariant),
        childFieldsFromSchema(arrayVariant),
        null,
        collectEnumValues(arrayVariant),
      ),
    ]
  }

  return [
    field(
      "value",
      describeFieldType(schema),
      true,
      collectFieldConstraints(schema),
      childFieldsFromSchema(schema),
      null,
      collectEnumValues(schema),
    ),
  ]
}

function propertyFieldsFromObject(schema: Record<string, unknown>): NodeContractField[] {
  if (!isRecord(schema.properties)) {
    return []
  }

  const required = new Set(getStringArray(schema.required))

  return Object.entries(schema.properties).map(([name, value]) =>
    fieldFromSchema(name, value, required.has(name)),
  )
}

function fieldFromSchema(name: string, schema: unknown, required: boolean): NodeContractField {
  return field(
    name,
    describeFieldType(schema),
    required,
    collectFieldConstraints(schema),
    childFieldsFromSchema(schema),
    fieldNoteFromSchema(schema),
    collectEnumValues(schema),
  )
}

function childFieldsFromSchema(schema: unknown): NodeContractField[] {
  const objectVariant = findObjectVariant(schema)
  if (objectVariant) {
    const propertyFields = propertyFieldsFromObject(objectVariant)
    if (propertyFields.length > 0) {
      return propertyFields
    }
  }

  const arrayVariant = findArrayVariant(schema)
  if (!arrayVariant || !isRecord(arrayVariant.items)) {
    return []
  }

  const itemSchema = arrayVariant.items
  const itemObjectVariant = findObjectVariant(itemSchema)
  if (itemObjectVariant) {
    return propertyFieldsFromObject(itemObjectVariant)
  }

  return []
}

function describeSchemaFallback(schema: unknown): string {
  if (!isRecord(schema)) {
    return "Schema is available but has no named fields."
  }

  return `${capitalize(describeFieldType(schema))} payload.`
}

function describeFieldType(schema: unknown): string {
  if (!isRecord(schema)) {
    return "data"
  }

  const variants = schemaVariants(schema)
  const nullable = variants.some(isNullVariant)
  const labels = unique(
    variants
      .filter((variant) => !isNullVariant(variant))
      .map(describeSingleFieldType)
      .filter((value): value is string => value !== ""),
  )

  let typeLabel = labels.length > 0 ? labels.join(" or ") : "data"
  if (nullable) {
    typeLabel = `${typeLabel} or empty`
  }

  return typeLabel
}

function describeSingleFieldType(schema: Record<string, unknown>): string {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    if (typeof schema.type === "string") {
      return humanizePrimitiveType(schema.type)
    }

    return inferEnumPrimitiveType(schema.enum)
  }

  if (Object.prototype.hasOwnProperty.call(schema, "const")) {
    return formatLiteral(schema.const)
  }

  if (typeof schema.$ref === "string") {
    return "object"
  }

  if (schema.type === "array") {
    return "array"
  }

  if (schema.type === "object") {
    const recordValueSchema = getRecordValueSchema(schema)
    if (recordValueSchema && !isRecord(schema.properties)) {
      return "object"
    }

    return "object"
  }

  if (typeof schema.type === "string") {
    return humanizePrimitiveType(schema.type)
  }

  if (Array.isArray(schema.type)) {
    return schema.type
      .filter((value): value is string => typeof value === "string")
      .map(humanizePrimitiveType)
      .join(" or ")
  }

  return "data"
}

function collectSchemaRules(schema: unknown, path = ""): string[] {
  if (!isRecord(schema)) {
    return []
  }

  const rules: string[] = []
  const objectVariant = findObjectVariant(schema)

  if (!path && objectVariant) {
    const required = getStringArray(objectVariant.required)
    if (required.length > 0) {
      rules.push(`Required fields: ${required.join(", ")}`)
    }

    if (objectVariant.additionalProperties === false) {
      rules.push("No extra fields allowed.")
    }
  }

  const constraints = collectFieldConstraints(schema)
  if (constraints.length > 0 && path) {
    rules.push(`${path}: ${constraints.join(", ")}`)
  }

  if (objectVariant && isRecord(objectVariant.properties)) {
    for (const [key, value] of Object.entries(objectVariant.properties)) {
      const nextPath = path ? `${path}.${key}` : key
      rules.push(...collectSchemaRules(value, nextPath))
    }
  }

  const arrayVariant = findArrayVariant(schema)
  if (arrayVariant) {
    const nextPath = path ? `${path}[]` : "items[]"
    rules.push(...collectSchemaRules(arrayVariant.items, nextPath))
  }

  return unique(rules)
}

function collectFieldConstraints(schema: unknown): string[] {
  if (!isRecord(schema)) {
    return []
  }

  const constraints: string[] = []

  if (typeof schema.format === "string") {
    constraints.push(`format: ${schema.format}`)
  }

  if (typeof schema.pattern === "string") {
    constraints.push(`pattern: ${schema.pattern}`)
  }

  if (typeof schema.minLength === "number") {
    constraints.push(`min length: ${schema.minLength}`)
  }

  if (typeof schema.maxLength === "number") {
    constraints.push(`max length: ${schema.maxLength}`)
  }

  if (typeof schema.minimum === "number") {
    constraints.push(`>= ${schema.minimum}`)
  }

  if (typeof schema.exclusiveMinimum === "number") {
    constraints.push(`> ${schema.exclusiveMinimum}`)
  }

  if (typeof schema.maximum === "number") {
    constraints.push(`<= ${schema.maximum}`)
  }

  if (typeof schema.exclusiveMaximum === "number") {
    constraints.push(`< ${schema.exclusiveMaximum}`)
  }

  if (typeof schema.multipleOf === "number") {
    constraints.push(`multiple of: ${schema.multipleOf}`)
  }

  if (typeof schema.minItems === "number") {
    constraints.push(`min items: ${schema.minItems}`)
  }

  if (typeof schema.maxItems === "number") {
    constraints.push(`max items: ${schema.maxItems}`)
  }

  if (schema.additionalProperties === false && hasObjectProperties(schema)) {
    constraints.push("no extra keys")
  }

  return unique(constraints)
}

function collectEnumValues(schema: unknown): string[] {
  if (!isRecord(schema) || !Array.isArray(schema.enum)) {
    return []
  }

  return unique(schema.enum.map(formatLiteral))
}

function fieldNoteFromSchema(schema: unknown): string | null {
  if (!isRecord(schema)) {
    return null
  }

  const arrayVariant = findArrayVariant(schema)
  if (arrayVariant && isRecord(arrayVariant.items) && findObjectVariant(arrayVariant.items)) {
    return "Each item contains its own nested fields."
  }

  const objectVariant = findObjectVariant(schema)
  if (objectVariant) {
    const recordValueSchema = getRecordValueSchema(objectVariant)
    if (recordValueSchema && !isRecord(objectVariant.properties)) {
      return "Dynamic object keys share the same value shape."
    }
  }

  return null
}

function buildBranchRules(branches: unknown): string[] {
  if (!Array.isArray(branches)) {
    return []
  }

  return branches
    .map((branch) => {
      if (!isRecord(branch) || typeof branch.id !== "string") {
        return null
      }

      const label =
        typeof branch.label === "string" && branch.label !== "" ? ` (${branch.label})` : ""
      return `Branch: ${branch.id}${label}`
    })
    .filter((rule): rule is string => typeof rule === "string")
}

function outputMappingSection(outputs: unknown, note: string): NodeContractSchemaSection {
  return schemaSection(note, outputMappingFields(outputs))
}

function outputMappingFields(outputs: unknown): NodeContractField[] {
  if (!isRecord(outputs)) {
    return []
  }

  return Object.entries(outputs).map(([name, value]) =>
    field(name, describeMappedValueType(value), true, [], [], mappedValueNote(value)),
  )
}

function buildOutputMappingRules(outputs: unknown): string[] {
  if (!isRecord(outputs)) {
    return []
  }

  return Object.entries(outputs).map(([name, value]) => `${name} <- ${formatValue(value)}`)
}

function describeMappedValueType(value: unknown): string {
  if (typeof value === "boolean") return "boolean"
  if (typeof value === "number") return "number"
  if (typeof value === "string") {
    return isTemplateString(value) ? "unknown" : "string"
  }
  if (Array.isArray(value)) return "array"
  if (isRecord(value)) return "object"
  return "unknown"
}

function mappedValueNote(value: unknown): string | null {
  if (typeof value === "string") {
    return value
  }

  if (value === null || value === undefined) {
    return null
  }

  return formatValue(value)
}

function payloadSection(note: string): NodeContractSchemaSection {
  return schemaSection(note, [field("payload", "object", true)])
}

function schemaSection(
  note: string | null,
  fields: NodeContractField[],
): NodeContractSchemaSection {
  return { note, fields }
}

function validationSection(note: string | null, rules: string[]): NodeContractValidationSection {
  return { note, rules }
}

function field(
  name: string,
  type: string,
  required: boolean | null,
  constraints: string[] = [],
  children: NodeContractField[] = [],
  note: string | null = null,
  enumValues: string[] = [],
): NodeContractField {
  return {
    name,
    type,
    required,
    enumValues,
    constraints,
    children,
    note,
  }
}

function maybeRule(label: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  return `${label}: ${formatValue(value)}`
}

function maybeProcedureRule(moduleName: unknown, procedureName: unknown): string | null {
  if (typeof moduleName !== "string" || moduleName === "") {
    return null
  }

  if (typeof procedureName !== "string" || procedureName === "") {
    return `Procedure module: ${moduleName}`
  }

  return `Procedure: ${moduleName}.${procedureName}`
}

function findProcedure(
  catalog: ProcedureCatalogModule[],
  moduleName: string,
  procedureName: string,
): ProcedureCatalogProcedure | null {
  const moduleEntry = catalog.find((entry) => entry.module === moduleName)
  return moduleEntry?.procedures.find((entry) => entry.name === procedureName) ?? null
}

function getNodeType(node: FlowNodeLike): string {
  return typeof node.data.type === "string" ? node.data.type : node.type
}

function hasObjectProperties(schema: Record<string, unknown>): boolean {
  return isRecord(schema.properties) && Object.keys(schema.properties).length > 0
}

function getRecordValueSchema(schema: Record<string, unknown>): unknown {
  return isRecord(schema.additionalProperties) ? schema.additionalProperties : null
}

function findObjectVariant(schema: unknown): Record<string, unknown> | null {
  return schemaVariants(schema).find((variant) => variant.type === "object") ?? null
}

function findArrayVariant(schema: unknown): Record<string, unknown> | null {
  return schemaVariants(schema).find((variant) => variant.type === "array") ?? null
}

function schemaVariants(schema: unknown): Record<string, unknown>[] {
  if (!isRecord(schema)) {
    return []
  }

  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf.filter(isRecord)
  }

  if (Array.isArray(schema.anyOf)) {
    return schema.anyOf.filter(isRecord)
  }

  return [schema]
}

function isNullVariant(schema: Record<string, unknown>): boolean {
  return schema.type === "null" || schema.const === null
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === "string")
}

function formatLiteral(value: unknown): string {
  return typeof value === "string" ? value : String(value)
}

function humanizePrimitiveType(type: string): string {
  switch (type) {
    case "string":
      return "string"
    case "boolean":
      return "boolean"
    case "integer":
    case "number":
      return "number"
    case "null":
      return "null"
    default:
      return type
  }
}

function inferEnumPrimitiveType(values: unknown[]): string {
  const sample = values.find((value) => value !== null && value !== undefined)

  switch (typeof sample) {
    case "string":
      return "string"
    case "number":
      return "number"
    case "boolean":
      return "boolean"
    default:
      return "string"
  }
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (value === null || value === undefined) {
    return "null"
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function truncateValue(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`
}

function isTemplateString(value: string): boolean {
  return value.startsWith("{{") && value.endsWith("}}")
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value !== ""))]
}

function compact(values: Array<string | null | undefined>): string[] {
  return values.filter((value): value is string => typeof value === "string" && value !== "")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value
}
