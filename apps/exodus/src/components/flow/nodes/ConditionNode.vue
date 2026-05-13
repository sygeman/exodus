<script setup lang="ts">
import { Handle, Position, type NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import NodeWrapper from "./NodeWrapper.vue"

defineProps<NodeProps<VueFlowNodeData>>()
</script>

<template>
  <NodeWrapper :id="id" :data="data" :selected="selected" icon="i-lucide-git-branch">
    <template #handles>
      <Handle
        id="true"
        type="source"
        :position="Position.Right"
        :style="{ top: '30%' }"
        class="!bg-default !size-3 !border"
      />
      <Handle
        id="false"
        type="source"
        :position="Position.Right"
        :style="{ top: '70%' }"
        class="!bg-default !size-3 !border"
      />
    </template>
  </NodeWrapper>
</template>
