<script setup lang="ts">
import { computed } from "vue"
import { Handle, Position, type NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import NodeWrapper from "./NodeWrapper.vue"

type SwitchCase = {
  value: string
  handle: string
  label?: string
}

const props = defineProps<NodeProps<VueFlowNodeData>>()

const cases = computed<SwitchCase[]>(() => {
  const configCases = props.data.config?.cases as SwitchCase[] | undefined
  return (
    configCases || [
      { value: "case1", handle: "case1", label: "1" },
      { value: "case2", handle: "case2", label: "2" },
    ]
  )
})

const handlePositions = computed(() => {
  const total = cases.value.length + 1
  return cases.value.map((_, i) => ({
    top: `${((i + 1) / (total + 1)) * 100}%`,
  }))
})

const defaultPosition = computed(() => ({
  top: `${((cases.value.length + 1) / (cases.value.length + 2)) * 100}%`,
}))
</script>

<template>
  <NodeWrapper :id="id" :data="data" :selected="selected" icon="i-lucide-git-fork">
    <template #handles>
      <template v-for="(c, i) in cases" :key="c.handle">
        <Handle
          :id="c.handle"
          type="source"
          :position="Position.Right"
          :style="handlePositions[i]"
          class="!bg-default !size-3 !border"
        >
          <span class="text-[8px] font-bold">{{ i + 1 }}</span>
        </Handle>
      </template>
      <Handle
        id="default"
        type="source"
        :position="Position.Right"
        :style="defaultPosition"
        class="!bg-default !size-3 !border"
      >
        <UIcon name="i-lucide-asterisk" class="size-2" />
      </Handle>
    </template>
  </NodeWrapper>
</template>
