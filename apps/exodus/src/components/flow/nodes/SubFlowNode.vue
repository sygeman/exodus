<script setup lang="ts">
import { Handle, Position, type NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import NodeWrapper from "./NodeWrapper.vue"

defineProps<NodeProps<VueFlowNodeData>>()
</script>

<template>
  <NodeWrapper :data="data" :selected="selected" icon="i-lucide-workflow">
    <template #handles>
      <Handle
        id="success"
        type="source"
        :position="Position.Right"
        :style="{ top: '30%' }"
        class="!bg-default !size-3 !border"
      >
        <UIcon name="i-lucide-check" class="size-2" />
      </Handle>
      <Handle
        id="error"
        type="source"
        :position="Position.Right"
        :style="{ top: '70%' }"
        class="!bg-default !size-3 !border"
      >
        <UIcon name="i-lucide-x" class="size-2" />
      </Handle>
    </template>
  </NodeWrapper>
</template>
