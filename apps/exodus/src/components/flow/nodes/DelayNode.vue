<script setup lang="ts">
import type { NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import NodeWrapper from "./NodeWrapper.vue"

defineProps<NodeProps<VueFlowNodeData>>()
</script>

<template>
  <NodeWrapper :id="id" :data="data" :selected="selected" icon="i-lucide-timer" />
</template>
