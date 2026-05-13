<script setup lang="ts">
import { computed } from "vue"
import { Handle, Position, type NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import NodeWrapper from "./NodeWrapper.vue"

const props = defineProps<NodeProps<VueFlowNodeData>>()

const ACTION_ICONS: Record<string, string> = {
  download: "i-lucide-download",
  convert: "i-lucide-file-video",
  extract: "i-lucide-archive",
  find_files: "i-lucide-file-search",
  install: "i-lucide-package",
  delete: "i-lucide-trash",
  copy: "i-lucide-copy",
  move: "i-lucide-folder-input",
  notify: "i-lucide-bell",
  http: "i-lucide-globe",
  script: "i-lucide-terminal",
}

const actionIcon = computed(() => ACTION_ICONS[props.data.actionType || ""] || "i-lucide-zap")
</script>

<template>
  <NodeWrapper :id="id" :data="data" :selected="selected" :icon="actionIcon">
    <template #handles>
      <Handle
        id="success"
        type="source"
        :position="Position.Right"
        :style="{ top: '30%' }"
        class="!bg-default !size-3 !border"
      />
      <Handle
        id="error"
        type="source"
        :position="Position.Right"
        :style="{ top: '70%' }"
        class="!bg-default !size-3 !border"
      />
    </template>
  </NodeWrapper>
</template>
