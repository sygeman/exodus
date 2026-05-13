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
  <NodeWrapper :id="id" :data="data" :selected="selected" icon="i-lucide-workflow">
    <template #handles>
      <UTooltip text="Успех" :popper="{ placement: 'right' }">
        <Handle
          id="success"
          type="source"
          :position="Position.Right"
          :style="{ top: '30%' }"
          class="!bg-default border-default !flex !size-3 !items-center !justify-center !border"
          :class="getHandleClass('success', 'success')"
        >
          <UIcon
            name="i-lucide-check"
            class="size-2"
            :class="getHandleIconClass('success', 'success')"
          />
        </Handle>
      </UTooltip>
      <UTooltip text="Ошибка" :popper="{ placement: 'right' }">
        <Handle
          id="error"
          type="source"
          :position="Position.Right"
          :style="{ top: '70%' }"
          class="!bg-default border-default !flex !size-3 !items-center !justify-center !border"
          :class="getHandleClass('error', 'error')"
        >
          <UIcon name="i-lucide-x" class="size-2" :class="getHandleIconClass('error', 'error')" />
        </Handle>
      </UTooltip>
    </template>
  </NodeWrapper>
</template>
