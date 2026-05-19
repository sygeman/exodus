import flowCodeScreen from "../../../edem-manifests/components/FlowCodePage.json"
import type { LogicFlowDefinition, ScreenManifestDefinition } from "../contracts"
import { getRuntimeFlowsForScreen } from "../flows"

type RuntimeComponentNode = {
  queries?: ScreenManifestDefinition["queries"]
  state?: ScreenManifestDefinition["state"]
  computed?: ScreenManifestDefinition["computed"]
}

export interface RuntimeScreenEntry {
  screen: ScreenManifestDefinition
  flows: Record<string, LogicFlowDefinition>
}

export const runtimeScreens: Record<string, RuntimeScreenEntry> = {
  FlowCodePage: {
    screen: {
      id: "FlowCodePage",
      root: flowCodeScreen as ScreenManifestDefinition["root"],
      queries: (flowCodeScreen as RuntimeComponentNode).queries,
      state: (flowCodeScreen as RuntimeComponentNode).state,
      computed: (flowCodeScreen as RuntimeComponentNode).computed,
    } satisfies ScreenManifestDefinition,
    flows: getRuntimeFlowsForScreen("FlowCodePage"),
  },
}
