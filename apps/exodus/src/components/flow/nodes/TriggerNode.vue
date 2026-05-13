<script setup lang="ts">
import { computed } from "vue"
import type { NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import NodeWrapper from "./NodeWrapper.vue"

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
  <NodeWrapper :id="id" :data="data" :selected="selected" :icon="triggerIcon" hide-target-handle />
</template>
