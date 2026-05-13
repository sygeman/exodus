<script setup lang="ts">
import { Handle, Position, type NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import NodeWrapper from "./NodeWrapper.vue"
import { useNodeTestMode } from "@/composables/useNodeTestMode"

const props = defineProps<NodeProps<VueFlowNodeData>>()

const { getHandleClass, getHandleIconClass } = useNodeTestMode(
  () => props.data,
  () => props.selected,
)
</script>

<template>
  <NodeWrapper :id="id" :data="data" :selected="selected" icon="i-lucide-shuffle">
    <template #handles>
      <UTooltip text="Результат" :popper="{ placement: 'right' }">
        <Handle
          id="output"
          type="source"
          :position="Position.Right"
          :style="{ top: '50%' }"
          class="!bg-default !border-default !flex !size-3 !items-center !justify-center !border"
          :class="getHandleClass('output', 'success')"
        >
          <UIcon
            name="i-lucide-arrow-right"
            class="size-2"
            :class="getHandleIconClass('output', 'success')"
          />
        </Handle>
      </UTooltip>
    </template>
  </NodeWrapper>
</template>
