import type { IR } from "./ir"

// ── Validate IR ───────────────────────────────────────────────────────────────
// Cross-reference validation between manifests.

export interface ValidationError {
  type: "error" | "warning"
  message: string
  path: string
}

export function validateIR(ir: IR): ValidationError[] {
  const errors: ValidationError[] = []

  validateRoutes(ir, errors)
  validateComponents(ir, errors)
  validateCollections(ir, errors)
  validateFlows(ir, errors)
  validateTemplateFields(ir, errors)

  return errors
}

function validateRoutes(ir: IR, errors: ValidationError[]): void {
  const componentNames = new Set(ir.components.map((c) => c.name))

  for (const route of ir.routes) {
    if (route.componentName && !componentNames.has(route.componentName)) {
      errors.push({
        type: "error",
        message: `Route "${route.path}" references unknown component "${route.componentName}"`,
        path: `routes.${route.path}`,
      })
    }
  }
}

function validateComponents(ir: IR, errors: ValidationError[]): void {
  const collectionIds = new Set(ir.collections.map((c) => c.id))
  const flowIds = new Set(ir.flows.map((f) => f.id))

  for (const comp of ir.components) {
    for (const col of comp.usedCollections) {
      if (!collectionIds.has(col)) {
        errors.push({
          type: "error",
          message: `Component "${comp.name}" uses unknown collection "${col}"`,
          path: `components.${comp.name}`,
        })
      }
    }

    for (const flow of comp.usedFlows) {
      if (!flowIds.has(flow)) {
        errors.push({
          type: "warning",
          message: `Component "${comp.name}" triggers unknown flow "${flow}"`,
          path: `components.${comp.name}`,
        })
      }
    }
  }
}

function validateCollections(ir: IR, errors: ValidationError[]): void {
  const validTypes = new Set(["string", "text", "number", "boolean", "uuid", "json", "datetime"])

  for (const col of ir.collections) {
    for (const field of col.fields) {
      if (!validTypes.has(field.type)) {
        errors.push({
          type: "warning",
          message: `Collection "${col.id}" has unknown field type "${field.type}"`,
          path: `collections.${col.id}.fields.${field.name}`,
        })
      }
    }
  }
}

function validateFlows(ir: IR, errors: ValidationError[]): void {
  for (const flow of ir.flows) {
    const nodeIds = new Set(flow.nodes.map((n) => n.id))

    for (const edge of flow.edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push({
          type: "error",
          message: `Flow "${flow.id}" edge references unknown source node "${edge.source}"`,
          path: `flows.${flow.id}.edges.${edge.id}`,
        })
      }
      if (!nodeIds.has(edge.target)) {
        errors.push({
          type: "error",
          message: `Flow "${flow.id}" edge references unknown target node "${edge.target}"`,
          path: `flows.${flow.id}.edges.${edge.id}`,
        })
      }
    }
  }
}

function validateTemplateFields(ir: IR, errors: ValidationError[]): void {
  for (const comp of ir.components) {
    validateNodeFields(comp.tree, comp.name, ir, errors)
  }
}

function validateNodeFields(
  node: import("@exodus/edem-ui").ComponentNode,
  compName: string,
  ir: IR,
  errors: ValidationError[],
): void {
  if (node.bind?.collection) {
    const col = ir.collections.find((c) => c.id === node.bind!.collection)
    if (col) {
      // Validate filter fields exist
      if (node.bind!.filter) {
        for (const fieldPath of Object.keys(node.bind!.filter)) {
          if (!col.fields.some((f) => f.name === fieldPath) && fieldPath !== "id") {
            errors.push({
              type: "warning",
              message: `Component "${compName}" filters on unknown field "${fieldPath}" in collection "${col.id}"`,
              path: `components.${compName}`,
            })
          }
        }
      }

      // Validate sort fields exist
      if (node.bind!.sort) {
        for (const sortField of node.bind!.sort) {
          const field = sortField.replace(/^-/, "")
          if (!col.fields.some((f) => f.name === field) && field !== "created_at") {
            errors.push({
              type: "warning",
              message: `Component "${compName}" sorts on unknown field "${field}" in collection "${col.id}"`,
              path: `components.${compName}`,
            })
          }
        }
      }
    }
  }

  // Validate template expressions reference valid fields
  const validateExpr = (expr: string) => {
    const fieldMatches = expr.matchAll(/\{\{\s*item\.(\w+)\s*\}\}/g)
    for (const m of fieldMatches) {
      const fieldName = m[1]
      if (node.bind?.collection) {
        const col = ir.collections.find((c) => c.id === node.bind!.collection)
        if (col && !col.fields.some((f) => f.name === fieldName) && fieldName !== "id") {
          errors.push({
            type: "warning",
            message: `Component "${compName}" references unknown field "item.${fieldName}" in collection "${col.id}"`,
            path: `components.${compName}`,
          })
        }
      }
    }
  }

  if (node.props) {
    for (const value of Object.values(node.props)) {
      if (typeof value === "string") validateExpr(value)
    }
  }

  if (typeof node.children === "string") {
    validateExpr(node.children)
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      validateNodeFields(child, compName, ir, errors)
    }
  }
}
