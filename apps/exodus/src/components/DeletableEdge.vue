<script setup lang="ts">
import { ref, computed, inject } from "vue"
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@vue-flow/core"

const props = defineProps<EdgeProps>()

const deleteEdge = inject<(edgeId: string) => void>("deleteEdge")

const isHovered = ref(false)

const path = computed(() => {
  return getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  })
})

const labelX = computed(() => (props.sourceX + props.targetX) / 2)
const labelY = computed(() => (props.sourceY + props.targetY) / 2)

function onDelete() {
  deleteEdge?.(props.id)
}
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path[0]"
    :marker-end="markerEnd"
    :style="style"
    class="edge-path"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  />

  <path
    :d="path[0]"
    fill="none"
    stroke="transparent"
    stroke-width="20"
    class="edge-interaction-zone"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  />

  <EdgeLabelRenderer>
    <div
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
        pointerEvents: 'all',
      }"
      class="nodrag nopan"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <button
        v-show="isHovered"
        class="bg-error hover:bg-error/80 flex size-5 items-center justify-center rounded-full text-white shadow-md transition-all"
        @click="onDelete"
      >
        <UIcon name="i-lucide-x" class="size-3" />
      </button>
    </div>
  </EdgeLabelRenderer>
</template>

<style scoped>
.edge-interaction-zone {
  cursor: pointer;
}
</style>
