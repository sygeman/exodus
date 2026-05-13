<script setup lang="ts">
import { computed, inject } from "vue"
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

const retryFromNode = inject<((nodeId: string) => void) | null>("retryFromNode", null)

const label = computed(() => generateNodeLabel(props.data))
const params = computed(() => generateNodeParams(props.data))

const { isRunning, isFailed, borderClass, handleBorderClass, showErrorTooltip, iconColorClass } =
  useNodeTestMode(
    () => props.data,
    () => props.selected,
  )

const showRetryButton = computed(() => {
  return props.data.testMode && isFailed.value && retryFromNode
})

function handleRetry(e: Event) {
  e.stopPropagation()
  if (retryFromNode && props.id) {
    retryFromNode(props.id)
  }
}
</script>

<template>
  <div class="relative w-40">
    <div
      class="flow-node bg-default border-default rounded-lg border shadow-md transition-all hover:border-neutral-400 hover:shadow-lg"
      :class="[borderClass]"
    >
      <div
        v-if="isRunning && data.progress !== undefined"
        class="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
      >
        <div class="pulse-progress h-full bg-white/20" :style="{ width: `${data.progress}%` }" />
      </div>

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
          <button
            v-if="showRetryButton"
            class="text-muted hover:text-highlighted size-4 shrink-0 transition-colors"
            title="Перезапустить с этой ноды"
            @click="handleRetry"
          >
            <UIcon name="i-lucide-rotate-ccw" class="size-3" />
          </button>
        </div>

        <p v-if="isFailed && data.error && !data.testMode" class="text-error mt-2 truncate text-xs">
          {{ data.error }}
        </p>
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

    <div
      v-if="showErrorTooltip"
      class="bg-error absolute top-full left-0 z-50 mt-1 max-w-[200px] rounded px-3 py-2 text-xs text-white shadow-lg"
    >
      {{ data.error }}
    </div>
  </div>
</template>

<style scoped>
.flow-node {
  font-family: inherit;
}
</style>
