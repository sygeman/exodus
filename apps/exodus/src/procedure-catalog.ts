export type ProcedureKind = "query" | "mutation" | "subscription"

export type ProcedureCatalogProcedure = {
  name: string
  kind: ProcedureKind
}

export type ProcedureCatalogModule = {
  module: string
  procedures: ProcedureCatalogProcedure[]
}

export type SelectOption = {
  label: string
  value: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isProcedureKind(value: unknown): value is ProcedureKind {
  return value === "query" || value === "mutation" || value === "subscription"
}

export function normalizeProcedureCatalog(value: unknown): ProcedureCatalogModule[] {
  if (!Array.isArray(value)) return []

  return value
    .flatMap((entry) => {
      if (
        !isRecord(entry) ||
        typeof entry.module !== "string" ||
        !Array.isArray(entry.procedures)
      ) {
        return []
      }

      const procedures = entry.procedures
        .flatMap((procedure) => {
          if (
            !isRecord(procedure) ||
            typeof procedure.name !== "string" ||
            !isProcedureKind(procedure.kind)
          ) {
            return []
          }

          return [{ name: procedure.name, kind: procedure.kind }]
        })
        .toSorted((left, right) => left.name.localeCompare(right.name))

      return [{ module: entry.module, procedures }]
    })
    .toSorted((left, right) => left.module.localeCompare(right.module))
}

export function isCallableProcedure(procedure: ProcedureCatalogProcedure): boolean {
  return procedure.kind === "query" || procedure.kind === "mutation"
}

export function listCallableModuleOptions(catalog: ProcedureCatalogModule[]): SelectOption[] {
  return catalog
    .filter((entry) => entry.procedures.some(isCallableProcedure))
    .map((entry) => ({ label: entry.module, value: entry.module }))
}

export function listCallableProcedureOptions(
  catalog: ProcedureCatalogModule[],
  moduleName: string,
): SelectOption[] {
  if (!moduleName) return []

  const entry = catalog.find((candidate) => candidate.module === moduleName)
  if (!entry) return []

  return entry.procedures.filter(isCallableProcedure).map((procedure) => ({
    label: `${procedure.name} (${procedure.kind})`,
    value: procedure.name,
  }))
}

export function listSubscriptionProcedureOptions(
  catalog: ProcedureCatalogModule[],
): SelectOption[] {
  return catalog.flatMap((entry) =>
    entry.procedures
      .filter((procedure) => procedure.kind === "subscription")
      .map((procedure) => ({
        label: `${entry.module}.${procedure.name}`,
        value: `${entry.module}.${procedure.name}`,
      })),
  )
}
