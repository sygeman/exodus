<script setup lang="ts">
import { computed, inject, type Ref } from "vue"
import { useT } from "@exodus/edem-vue"
import { Handle, Position, type NodeProps } from "@vue-flow/core"
import type { DataManifest as ProjectDataManifest } from "@/project-manifest-schemas"
import type { ProcedureCatalogModule } from "@/procedure-catalog"
import { getNodeIcon, type VueFlowNodeData } from "@/types/flow"
import { useNodeTestMode } from "@/composables/useNodeTestMode"
import {
  getNodeDisplayLabel,
  type GraphEdge,
  type GraphNode,
  type ProjectFlowItem,
  useFlowMapEditorModel,
} from "@/flow-map-editor"

type MapNodeData = VueFlowNodeData & {
  mappings?: unknown
}

const props = defineProps<NodeProps<MapNodeData>>()

const t = useT()

const injectedGraphNodesRef = inject<Ref<GraphNode[]>>("graphNodes")
const injectedGraphEdgesRef = inject<Ref<GraphEdge[]>>("graphEdges")
const injectedProjectFlowsRef = inject<Ref<ProjectFlowItem[]>>("projectFlows")
const injectedProcedureCatalogRef = inject<Ref<ProcedureCatalogModule[]>>("procedureCatalog")
const injectedProjectDataManifestRef =
  inject<Ref<ProjectDataManifest | null>>("projectDataManifest")
const injectedOpenMapEditor = inject<((nodeId: string) => void) | null>("openMapEditor", null)

if (
  !injectedGraphNodesRef ||
  !injectedGraphEdgesRef ||
  !injectedProjectFlowsRef ||
  !injectedProcedureCatalogRef ||
  !injectedProjectDataManifestRef
) {
  throw new Error("FlowMapNode requires graph context")
}

const graphNodesRef = injectedGraphNodesRef
const graphEdgesRef = injectedGraphEdgesRef
const projectFlows = injectedProjectFlowsRef
const procedureCatalog = injectedProcedureCatalogRef
const projectDataManifest = injectedProjectDataManifestRef

const { borderClass, showErrorTooltip, handleBorderClass, iconColorClass } = useNodeTestMode(
  () => props.data,
  () => props.selected,
)

const icon = computed(() => getNodeIcon("map"))

const model = useFlowMapEditorModel({
  nodeId: () => props.id,
  graphNodes: graphNodesRef,
  graphEdges: graphEdgesRef,
  projectFlows,
  procedureCatalog,
  projectDataManifest,
})

const contextLabel = computed(() => {
  const source = getNodeDisplayLabel(model.incomingNode.value)
  const target = getNodeDisplayLabel(model.outgoingNode.value)
  if (!source && !target) {
    return null
  }

  if (!source) {
    return `→ ${target}`
  }

  if (!target) {
    return `${source} →`
  }

  return `${source} → ${target}`
})

function openEditor(event: MouseEvent): void {
  event.stopPropagation()
  injectedOpenMapEditor?.(props.id)
}
</script>

<template>
  <div class="relative w-56">
    <div
      class="flow-node rounded-xl border border-neutral-300 bg-white/90 shadow-lg shadow-black/10 backdrop-blur-xl transition-all dark:border-neutral-500/50 dark:bg-neutral-900/90 dark:shadow-black/40"
      :class="[borderClass]"
      @dblclick="openEditor"
    >
      <Handle
        type="target"
        :position="Position.Left"
        class="!size-3 !border !border-black/10 !bg-neutral-200 dark:!border-white/20 dark:!bg-neutral-800"
        :class="handleBorderClass"
      />

      <Handle
        id="output"
        type="source"
        :position="Position.Right"
        class="!size-3 !border !border-black/10 !bg-neutral-200 dark:!border-white/20 dark:!bg-neutral-800"
        :class="handleBorderClass"
      />

      <div class="px-3 py-2">
        <div class="flex items-start gap-2">
          <UIcon :name="icon" class="text-muted mt-0.5 size-4 shrink-0" :class="iconColorClass" />
          <div class="min-w-0 flex-1">
            <p class="text-highlighted truncate text-sm font-medium">
              {{ t({ en: "Map", ru: "Маппер" }) }}
            </p>
            <p v-if="contextLabel" class="text-muted truncate font-mono text-[11px]">
              {{ contextLabel }}
            </p>
            <p class="text-muted truncate text-xs">
              {{
                t(
                  { en: "{mapped}/{total} mapped", ru: "{mapped}/{total} сопоставлено" },
                  { mapped: model.mappedTargetCount.value, total: model.totalTargetCount.value },
                )
              }}
              <span v-if="model.missingRequiredCount.value > 0">
                ·
                {{
                  t(
                    { en: "{n} missing", ru: "{n} не заполнено" },
                    { n: model.missingRequiredCount.value },
                  )
                }}
              </span>
            </p>
          </div>
          <UButton
            class="nodrag nopan"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-sliders-horizontal"
            @click="openEditor"
          />
        </div>
      </div>
    </div>

    <div
      v-if="showErrorTooltip"
      class="bg-error absolute top-full left-0 z-50 mt-1 max-w-[240px] rounded px-3 py-2 text-xs text-white shadow-lg"
    >
      {{ data.error }}
    </div>
  </div>
</template>

<style scoped>
.flow-node :deep(.vue-flow__handle) {
  border-color: var(--ui-border);
}
</style>
