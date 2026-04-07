<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import type { ACSDNodeData } from '~/types/acsd'

const props = defineProps<NodeProps<ACSDNodeData>>()

const levelColors: Record<string, string> = {
  L0: 'bg-amber-500/20 border-amber-500/50',
  L1: 'bg-blue-500/20 border-blue-500/50',
  L2: 'bg-green-500/20 border-green-500/50',
  L3: 'bg-purple-500/20 border-purple-500/50',
  L4: 'bg-neutral-500/20 border-neutral-500/50',
}

const handleColors: Record<string, string> = {
  L0: '!bg-amber-500/50 !border-amber-500/50',
  L1: '!bg-blue-500/50 !border-blue-500/50',
  L2: '!bg-green-500/50 !border-green-500/50',
  L3: '!bg-purple-500/50 !border-purple-500/50',
  L4: '!bg-neutral-500/50 !border-neutral-500/50',
}

const statusClasses = computed(() => {
  if (props.data.status === 'gap') {
    return 'border-dashed opacity-50'
  }
  return ''
})
</script>

<template>
  <div
    class="acsd-node rounded-lg border w-[160px] h-[80px] px-2 py-1.5 text-center transition-all overflow-hidden flex flex-col"
    :class="[levelColors[data.level], statusClasses]"
  >
    <Handle
      v-if="data.level !== 'L0'"
      type="target"
      :position="Position.Top"
      class="!w-2 !h-2"
      :class="handleColors[data.level]"
    />
    
    <div class="text-xs font-medium text-neutral-400 mb-0.5 shrink-0">
      {{ data.level }} • {{ data.type }}
    </div>
    
    <div class="text-sm text-neutral-100 line-clamp-2 overflow-hidden flex-1">
      {{ data.status === 'gap' ? '[?]' : data.text }}
    </div>
    
    <Handle
      type="source"
      :position="Position.Bottom"
      class="!w-2 !h-2"
      :class="handleColors[data.level]"
    />
  </div>
</template>

<style scoped>
.acsd-node {
  /* box-shadow управляется через VueFlow selected класс */
}
</style>
