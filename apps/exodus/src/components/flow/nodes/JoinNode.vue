<script setup lang="ts">
import { computed } from "vue"
import { Handle, Position, type NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import NodeWrapper from "./NodeWrapper.vue"

type JoinBranch = {
  id: string
  label?: string
}

const props = defineProps<NodeProps<VueFlowNodeData>>()

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
  <NodeWrapper
    :id="id"
    :data="data"
    :selected="selected"
    icon="i-lucide-merge"
    :hide-source-handle="true"
  >
    <template #handles>
      <template v-for="(branch, i) in branches" :key="branch.id">
        <Handle
          :id="branch.id"
          type="target"
          :position="Position.Left"
          :style="handlePositions[i]"
          class="!bg-default !size-3 !border"
        >
          <span class="text-[8px] font-bold">{{ i + 1 }}</span>
        </Handle>
      </template>
    </template>
  </NodeWrapper>
</template>
