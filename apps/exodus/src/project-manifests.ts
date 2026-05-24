import { buildProjectFlowsManifest, type ProjectFlowSourceItem } from "@/project-flow-source"
import {
  buildProjectDataManifest,
  type ProjectDataCollectionSourceItem,
} from "@/project-data-source"
import {
  buildProjectUiComponentsManifest,
  buildProjectUiRoutesManifest,
  type ProjectUiComponentSourceItem,
  type ProjectUiRouteSourceItem,
} from "@/project-ui-source"
import type { ProcedureCatalogModule } from "@/procedure-catalog"

type BuildProjectManifestsInput = {
  collections: ProjectDataCollectionSourceItem[]
  components: ProjectUiComponentSourceItem[]
  routes: ProjectUiRouteSourceItem[]
  flows: ProjectFlowSourceItem[]
  procedureCatalog?: ProcedureCatalogModule[]
}

export type ProjectBuildManifests = {
  data: ReturnType<typeof buildProjectDataManifest>
  components: ReturnType<typeof buildProjectUiComponentsManifest>
  routes: ReturnType<typeof buildProjectUiRoutesManifest>
  flows: ReturnType<typeof buildProjectFlowsManifest>
}

export function buildProjectManifests(input: BuildProjectManifestsInput): ProjectBuildManifests {
  return {
    data: buildProjectDataManifest(input.collections),
    components: buildProjectUiComponentsManifest(input.components),
    routes: buildProjectUiRoutesManifest(input.routes),
    flows: buildProjectFlowsManifest(input.flows, input.procedureCatalog),
  }
}
