<script setup lang="ts">
import { computed } from "vue"
import type { NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import BaseNode from "./BaseNode.vue"

const props = defineProps<NodeProps<VueFlowNodeData>>()

const TRIGGER_ICONS: Record<string, string> = {
  manual: "i-lucide-hand",
  scheduled: "i-lucide-clock",
  event: "i-lucide-zap",
}

const triggerIcon = computed(() => {
  const triggerType = props.data.config?.trigger_type as string | undefined
  return triggerType ? TRIGGER_ICONS[triggerType] || "i-lucide-play" : "i-lucide-play"
})
</script>

<template>
  <BaseNode
    :data="data"
    :icon="triggerIcon"
    node-color="primary"
    hide-target-handle
    :selected="selected"
  />
</template>
