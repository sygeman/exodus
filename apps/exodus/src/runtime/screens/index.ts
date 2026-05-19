import type { LogicFlowDefinition, ScreenManifestDefinition } from "../contracts"

type RuntimeComponentNode = {
  queries?: ScreenManifestDefinition["queries"]
  constants?: ScreenManifestDefinition["constants"]
  state?: ScreenManifestDefinition["state"]
  computed?: ScreenManifestDefinition["computed"]
  flows?: ScreenManifestDefinition["flows"]
}

export interface RuntimeScreenEntry {
  screen: ScreenManifestDefinition
  flows: Record<string, LogicFlowDefinition>
}

const manifestModules = import.meta.glob("../../../edem-manifests/components/*.json", {
  eager: true,
  import: "default",
}) as Record<string, ScreenManifestDefinition["root"] & RuntimeComponentNode>

const runtimeScreens = Object.fromEntries(
  Object.entries(manifestModules).map(([path, manifest]) => {
    const match = path.match(/\/([^/]+)\.json$/)
    const screenId = match?.[1]

    if (!screenId) {
      throw new Error(`Unable to derive screen id from manifest path: ${path}`)
    }

    return [
      screenId,
      {
        screen: {
          id: screenId,
          root: manifest,
          queries: manifest.queries,
          constants: manifest.constants,
          state: manifest.state,
          computed: manifest.computed,
          flows: manifest.flows,
        } satisfies ScreenManifestDefinition,
        flows: normalizeScreenFlows(manifest.flows),
      } satisfies RuntimeScreenEntry,
    ]
  }),
) as Record<string, RuntimeScreenEntry>

export function getRuntimeScreenEntry(screenId: string): RuntimeScreenEntry | undefined {
  return runtimeScreens[screenId]
}

function normalizeScreenFlows(
  flows: ScreenManifestDefinition["flows"],
): Record<string, LogicFlowDefinition> {
  if (!flows) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(flows).map(([flowId, flow]) => [
      flowId,
      {
        ...flow,
        id: flow.id || flowId,
        profile: flow.profile ?? "ui-action",
        runtime: flow.runtime ?? "client",
      } satisfies LogicFlowDefinition,
    ]),
  )
}
