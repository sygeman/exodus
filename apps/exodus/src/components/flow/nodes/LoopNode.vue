<script setup lang="ts">
import { computed } from "vue"
import { Handle, Position, type NodeProps } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import NodeWrapper from "./NodeWrapper.vue"
import { useNodeTestMode } from "@/composables/useNodeTestMode"

const props = defineProps<NodeProps<VueFlowNodeData>>()

const { getHandleClass, getHandleIconClass } = useNodeTestMode(
  () => props.data,
  () => props.selected,
)

const isParallel = computed(() => props.data.config?.parallel === true)
const loopIcon = computed(() => (isParallel.value ? "i-lucide-git-fork" : "i-lucide-repeat"))
</script>

<template>
  <NodeWrapper :id="id" :data="data" :selected="selected" :icon="loopIcon">
    <template #handles>
      <UTooltip text="Тело цикла (повтор)" :popper="{ placement: 'right' }">
        <Handle
          id="body"
          type="source"
          :position="Position.Right"
          :style="{ top: '30%' }"
          class="!bg-default !border-default !flex !size-3 !items-center !justify-center !border"
          :class="getHandleClass('body', 'info')"
        >
          <UIcon
            name="i-lucide-rotate-cw"
            class="size-2"
            :class="getHandleIconClass('body', 'info')"
          />
        </Handle>
      </UTooltip>
      <UTooltip text="Выход из цикла" :popper="{ placement: 'right' }">
        <Handle
          id="exit"
          type="source"
          :position="Position.Right"
          :style="{ top: '70%' }"
          class="!bg-default !border-default !flex !size-3 !items-center !justify-center !border"
          :class="getHandleClass('exit', 'success')"
        >
          <UIcon
            name="i-lucide-arrow-right"
            class="size-2"
            :class="getHandleIconClass('exit', 'success')"
          />
        </Handle>
      </UTooltip>
    </template>
  </NodeWrapper>
</template>
