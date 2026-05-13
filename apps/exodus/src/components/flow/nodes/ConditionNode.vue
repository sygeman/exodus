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
  <NodeWrapper :id="id" :data="data" :selected="selected" icon="i-lucide-git-branch">
    <template #handles>
      <UTooltip text="Да (true)" :popper="{ placement: 'right' }">
        <Handle
          id="true"
          type="source"
          :position="Position.Right"
          :style="{ top: '30%' }"
          class="!bg-default !flex !size-3 !items-center !justify-center !border"
          :class="getHandleClass('true', 'success')"
        >
          <UIcon
            name="i-lucide-check"
            class="size-2"
            :class="getHandleIconClass('true', 'success')"
          />
        </Handle>
      </UTooltip>
      <UTooltip text="Нет (false)" :popper="{ placement: 'right' }">
        <Handle
          id="false"
          type="source"
          :position="Position.Right"
          :style="{ top: '70%' }"
          class="!bg-default !flex !size-3 !items-center !justify-center !border"
          :class="getHandleClass('false', 'error')"
        >
          <UIcon name="i-lucide-x" class="size-2" :class="getHandleIconClass('false', 'error')" />
        </Handle>
      </UTooltip>
    </template>
  </NodeWrapper>
</template>
