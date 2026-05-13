<script setup lang="ts">
import { computed } from "vue"
import { Handle, Position, type NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import NodeWrapper from "./NodeWrapper.vue"
import { useNodeTestMode } from "@/composables/useNodeTestMode"

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

const { getHandleClass, getHandleIconClass } = useNodeTestMode(
  () => props.data,
  () => props.selected,
)
</script>

<template>
  <NodeWrapper :id="id" :data="data" :selected="selected" :icon="actionIcon">
    <template #handles>
      <UTooltip text="Успех" :popper="{ placement: 'right' }">
        <Handle
          id="success"
          type="source"
          :position="Position.Right"
          :style="{ top: '30%' }"
          class="!bg-default !border-default !flex !size-3 !items-center !justify-center !border"
          :class="getHandleClass('success', 'success')"
        >
          <UIcon
            name="i-lucide-check"
            class="size-2"
            :class="getHandleIconClass('success', 'success')"
          />
        </Handle>
      </UTooltip>
      <UTooltip text="Ошибка" :popper="{ placement: 'right' }">
        <Handle
          id="error"
          type="source"
          :position="Position.Right"
          :style="{ top: '70%' }"
          class="!bg-default !border-default !flex !size-3 !items-center !justify-center !border"
          :class="getHandleClass('error', 'error')"
        >
          <UIcon name="i-lucide-x" class="size-2" :class="getHandleIconClass('error', 'error')" />
        </Handle>
      </UTooltip>
    </template>
  </NodeWrapper>
</template>
