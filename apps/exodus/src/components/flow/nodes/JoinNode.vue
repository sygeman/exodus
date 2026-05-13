<script setup lang="ts">
import { computed } from "vue"
import { Handle, Position, type NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import NodeWrapper from "./NodeWrapper.vue"
import { useNodeTestMode } from "@/composables/useNodeTestMode"

type JoinBranch = {
  id: string
  label?: string
}

const props = defineProps<NodeProps<VueFlowNodeData>>()

const { getHandleClass, getHandleIconClass } = useNodeTestMode(
  () => props.data,
  () => props.selected,
)

const branches = computed<JoinBranch[]>(() => {
  const configBranches = props.data.config?.branches as JoinBranch[] | undefined
  return (
    configBranches || [
      { id: "branch1", label: "1" },
      { id: "branch2", label: "2" },
    ]
  )
})

const handlePositions = computed(() => {
  const total = branches.value.length
  return branches.value.map((_, i) => ({
    top: `${((i + 1) / (total + 1)) * 100}%`,
  }))
})
</script>

<template>
  <NodeWrapper :id="id" :data="data" :selected="selected" icon="i-lucide-merge" hide-source-handle>
    <template #handles>
      <template v-for="(branch, i) in branches" :key="branch.id">
        <UTooltip :text="branch.label || branch.id" :popper="{ placement: 'left' }">
          <Handle
            :id="branch.id"
            type="target"
            :position="Position.Left"
            :style="handlePositions[i]"
            class="!bg-default !flex !size-3 !items-center !justify-center !border"
            :class="getHandleClass(branch.id, 'info')"
          >
            <span class="text-[8px] font-bold" :class="getHandleIconClass(branch.id, 'info')">{{
              i + 1
            }}</span>
          </Handle>
        </UTooltip>
      </template>
    </template>
  </NodeWrapper>
</template>
