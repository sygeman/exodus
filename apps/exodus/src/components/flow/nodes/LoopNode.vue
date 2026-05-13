<script setup lang="ts">
import { computed } from "vue"
import { Handle, Position, type NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import NodeWrapper from "./NodeWrapper.vue"

const props = defineProps<NodeProps<VueFlowNodeData>>()

const isParallel = computed(() => props.data.config?.parallel === true)
const loopIcon = computed(() => (isParallel.value ? "i-lucide-git-fork" : "i-lucide-repeat"))
</script>

<template>
  <NodeWrapper :id="id" :data="data" :selected="selected" :icon="loopIcon">
    <template #handles>
      <Handle
        id="body"
        type="source"
        :position="Position.Right"
        :style="{ top: '30%' }"
        class="!bg-default !size-3 !border"
      >
        <UIcon name="i-lucide-rotate-cw" class="size-2" />
      </Handle>
      <Handle
        id="exit"
        type="source"
        :position="Position.Right"
        :style="{ top: '70%' }"
        class="!bg-default !size-3 !border"
      >
        <UIcon name="i-lucide-arrow-right" class="size-2" />
      </Handle>
    </template>
  </NodeWrapper>
</template>
