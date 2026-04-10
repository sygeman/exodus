<script setup lang="ts">
import type { EdgeProps } from '@vue-flow/core'
import { BaseEdge, getBezierPath } from '@vue-flow/core'

const props = defineProps<EdgeProps>()

const path = computed(() => {
  const [edgePath] = getBezierPath(props)
  return edgePath
})

const strokeColor = computed(() => {
  switch (props.data?.type) {
    case 'implements': return 'var(--color-neutral-600)'
    case 'requires': return 'var(--color-neutral-600)'
    case 'contradicts': return 'var(--color-error-600)'
    default: return 'var(--color-neutral-600)'
  }
})
</script>

<template>
  <BaseEdge
    :path="path"
    :style="{ stroke: strokeColor }"
    class="acsd-edge"
  />
</template>

<style scoped>
.acsd-edge {
  stroke-width: 1;
  opacity: 0.6;
}
</style>
