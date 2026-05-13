<script setup lang="ts">
import { computed } from "vue"
import { Handle, Position } from "@vue-flow/core"
import type { VueFlowNodeData } from "@/types/flow"
import { generateNodeLabel, generateNodeParams } from "@/composables/useNodeLabel"
import { useNodeTestMode } from "@/composables/useNodeTestMode"

type Props = {
  id?: string
  data: VueFlowNodeData
  selected?: boolean
  icon: string
  hideTargetHandle?: boolean
  hideSourceHandle?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  hideTargetHandle: false,
  hideSourceHandle: false,
})

const label = computed(() => generateNodeLabel(props.data))
const params = computed(() => generateNodeParams(props.data))

const { borderClass, handleBorderClass } = useNodeTestMode()

const iconColorClass = computed(() => {
  return "text-muted"
})
</script>

<template>
  <div class="relative w-40">
    <div
      class="flow-node bg-default overflow-hidden rounded-lg border shadow-md transition-all hover:border-neutral-400 hover:shadow-lg"
      :class="[borderClass]"
    >
      <Handle
        v-if="!hideTargetHandle"
        type="target"
        :position="Position.Left"
        class="!bg-default !size-3 !border"
        :class="handleBorderClass"
      />

      <div class="relative px-3 py-2">
        <div class="flex items-center gap-2">
          <UIcon :name="icon" class="size-4 shrink-0" :class="iconColorClass" />
          <p class="text-highlighted flex-1 truncate text-sm font-medium">
            {{ label }}<sup v-if="params" class="text-muted ml-1 font-normal">{{ params }}</sup>
          </p>
        </div>
      </div>

      <slot name="handles">
        <Handle
          v-if="!hideSourceHandle"
          type="source"
          :position="Position.Right"
          class="!bg-default !size-3 !border"
          :class="handleBorderClass"
        />
      </slot>
    </div>
  </div>
</template>

<style scoped>
.flow-node {
  font-family: inherit;
}
</style>
