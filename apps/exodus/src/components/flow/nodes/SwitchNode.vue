<script setup lang="ts">
import { computed } from "vue"
import { Handle, Position, type NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import NodeWrapper from "./NodeWrapper.vue"
import { useNodeTestMode } from "@/composables/useNodeTestMode"

type SwitchCase = {
  value: string
  handle: string
  label?: string
}

const props = defineProps<NodeProps<VueFlowNodeData>>()

const { getHandleClass, getHandleIconClass } = useNodeTestMode(
  () => props.data,
  () => props.selected,
)

const cases = computed<SwitchCase[]>(() => {
  const configCases = props.data.config?.cases as SwitchCase[] | undefined
  return (
    configCases || [
      { value: "case1", handle: "case1", label: "Case 1" },
      { value: "case2", handle: "case2", label: "Case 2" },
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
        <UTooltip :text="c.label || c.value" :popper="{ placement: 'right' }">
          <Handle
            :id="c.handle"
            type="source"
            :position="Position.Right"
            :style="handlePositions[i]"
            class="!bg-default border-default !flex !size-3 !items-center !justify-center !border"
            :class="getHandleClass(c.handle, 'info')"
          >
            <span class="text-[8px] font-bold" :class="getHandleIconClass(c.handle, 'info')">{{
              i + 1
            }}</span>
          </Handle>
        </UTooltip>
      </template>
      <UTooltip text="По умолчанию" :popper="{ placement: 'right' }">
        <Handle
          id="default"
          type="source"
          :position="Position.Right"
          :style="defaultPosition"
          class="!bg-default border-default !flex !size-3 !items-center !justify-center !border"
          :class="getHandleClass('default', 'neutral')"
        >
          <UIcon
            name="i-lucide-asterisk"
            class="size-2"
            :class="getHandleIconClass('default', 'neutral')"
          />
        </Handle>
      </UTooltip>
    </template>
  </NodeWrapper>
</template>
