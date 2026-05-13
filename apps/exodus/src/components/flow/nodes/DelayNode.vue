<script setup lang="ts">
import type { NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import BaseNode from "./BaseNode.vue"

defineProps<NodeProps<VueFlowNodeData>>()
</script>

<template>
  <BaseNode :data="data" icon="i-lucide-timer" node-color="warning" :selected="selected" />
</template>
