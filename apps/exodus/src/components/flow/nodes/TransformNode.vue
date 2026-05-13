<script setup lang="ts">
import { Handle, Position, type NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import NodeWrapper from "./NodeWrapper.vue"

defineProps<NodeProps<VueFlowNodeData>>()
</script>

<template>
  <NodeWrapper :id="id" :data="data" :selected="selected" icon="i-lucide-shuffle">
    <template #handles>
      <Handle
        id="output"
        type="source"
        :position="Position.Right"
        :style="{ top: '50%' }"
        class="!bg-default !size-3 !border"
      >
        <UIcon name="i-lucide-arrow-right" class="size-2" />
      </Handle>
    </template>
  </NodeWrapper>
</template>
