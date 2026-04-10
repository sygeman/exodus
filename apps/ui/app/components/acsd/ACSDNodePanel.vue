<script setup lang="ts">
import type { ACSDNode, ACSDEdge } from '~/types/acsd'

const props = defineProps<{
  node: ACSDNode | null
  projectName: string
  edges: ACSDEdge[]
  nodes: ACSDNode[]
}>()

const emit = defineEmits<{
  action: [action: string, nodeId: string]
  nodeSelect: [nodeId: string]
}>()

const typeLabels: Record<string, string> = {
  goal: 'Цель',
  component: 'Компонент',
  invariant: 'Инвариант',
  principle: 'Принцип',
  decision: 'Решение',
  constraint: 'Ограничение',
  non_goal: 'Не-цель',
}

const edgeTypeLabels: Record<string, string> = {
  implements: 'Детализирует',
  requires: 'Требует',
  part_of: 'Часть',
  supports: 'Поддерживает',
  contradicts: 'Противоречит',
}

// Исходящие связи (от текущей ноды)
const outgoingEdges = computed(() => {
  if (!props.node) return []
  return props.edges.filter(e => e.source === props.node!.id)
})

// Входящие связи (к текущей ноде)
const incomingEdges = computed(() => {
  if (!props.node) return []
  return props.edges.filter(e => e.target === props.node!.id)
})

// Получить ноду по ID
function getNodeById(id: string): ACSDNode | undefined {
  return props.nodes.find(n => n.id === id)
}

// Перейти к связанной ноде
function navigateToNode(nodeId: string) {
  emit('nodeSelect', nodeId)
}
</script>

<template>
  <div class="acsd-node-panel h-full bg-neutral-900 border-l border-neutral-800 p-4 overflow-y-auto">
    <!-- Ничего не выбрано -->
    <div v-if="!node" class="text-center py-8">
      <UIcon name="i-lucide-git-branch" class="w-12 h-12 text-neutral-600 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-neutral-200 mb-2">{{ projectName }}</h3>
      <p class="text-sm text-neutral-500">Выберите ноду в графе</p>
    </div>

    <!-- Draft (без уровня) -->
    <div v-else-if="node.level === null" class="space-y-4">
      <div class="flex items-center gap-2 text-neutral-500">
        <UIcon name="i-lucide-file-text" class="w-5 h-5" />
        <span class="font-medium">Draft</span>
      </div>

      <div class="text-sm text-neutral-200 leading-relaxed">
        {{ node.text }}
      </div>

      <p class="text-xs text-neutral-500">
        Уровень не определён. Стабилизируйте элемент для присвоения уровня.
      </p>

      <!-- Исходящие связи -->
      <div v-if="outgoingEdges.length > 0" class="pt-4 border-t border-neutral-800">
        <h4 class="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
          Связи ({{ outgoingEdges.length }})
        </h4>
        <div class="space-y-1">
          <div
            v-for="edge in outgoingEdges"
            :key="edge.id"
            class="flex items-center gap-2 p-2 rounded bg-neutral-800/50 cursor-pointer hover:bg-neutral-800 transition-colors"
            @click="navigateToNode(edge.target)"
          >
            <UIcon name="i-lucide-arrow-right" class="w-4 h-4 text-neutral-500" />
            <span class="text-xs text-neutral-400">{{ edgeTypeLabels[edge.type] || edge.type }}</span>
            <span class="text-sm text-neutral-200 truncate flex-1">{{ getNodeById(edge.target)?.text || edge.target }}</span>
          </div>
        </div>
      </div>

      <!-- Входящие связи -->
      <div v-if="incomingEdges.length > 0" class="pt-4 border-t border-neutral-800">
        <h4 class="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
          Связи ({{ incomingEdges.length }})
        </h4>
        <div class="space-y-1">
          <div
            v-for="edge in incomingEdges"
            :key="edge.id"
            class="flex items-center gap-2 p-2 rounded bg-neutral-800/50 cursor-pointer hover:bg-neutral-800 transition-colors"
            @click="navigateToNode(edge.source)"
          >
            <UIcon name="i-lucide-arrow-left" class="w-4 h-4 text-neutral-500" />
            <span class="text-xs text-neutral-400">{{ edgeTypeLabels[edge.type] || edge.type }}</span>
            <span class="text-sm text-neutral-200 truncate flex-1">{{ getNodeById(edge.source)?.text || edge.source }}</span>
          </div>
        </div>
      </div>

      <div class="pt-4 border-t border-neutral-800 space-y-2">
        <UButton
          block
          color="primary"
          variant="soft"
          @click="emit('action', 'edit', node.id)"
        >
          Доработать
        </UButton>

        <UButton
          block
          color="error"
          variant="ghost"
          @click="emit('action', 'delete', node.id)"
        >
          Удалить
        </UButton>
      </div>
    </div>

    <!-- Gap выбран -->
    <div v-else-if="node.status === 'gap'" class="space-y-4">
      <div class="flex items-center gap-2 text-amber-500">
        <UIcon name="i-lucide-help-circle" class="w-5 h-5" />
        <span class="font-medium">Gap {{ node.level }}</span>
      </div>
      
      <p class="text-sm text-neutral-400">
        Этот уровень каскада не заполнен
      </p>

      <UButton block color="primary" @click="emit('action', 'create', node.id)">
        Создать
      </UButton>
    </div>

    <!-- Нода выбрана -->
    <div v-else class="space-y-4">
      <div class="flex items-center justify-between">
        <UBadge :color="node.level === 'L0' ? 'amber' : 'neutral'" variant="soft">
          {{ node.level }}
        </UBadge>
        <UBadge color="neutral" variant="soft">
          {{ typeLabels[node.type] || node.type }}
        </UBadge>
      </div>

      <div class="text-sm text-neutral-200 leading-relaxed">
        {{ node.text }}
      </div>

      <!-- Исходящие связи -->
      <div v-if="outgoingEdges.length > 0" class="pt-4 border-t border-neutral-800">
        <h4 class="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
          Исходящие связи ({{ outgoingEdges.length }})
        </h4>
        <div class="space-y-1">
          <div
            v-for="edge in outgoingEdges"
            :key="edge.id"
            class="flex items-center gap-2 p-2 rounded bg-neutral-800/50 cursor-pointer hover:bg-neutral-800 transition-colors"
            @click="navigateToNode(edge.target)"
          >
            <UIcon name="i-lucide-arrow-right" class="w-4 h-4 text-neutral-500" />
            <span class="text-xs text-neutral-400">{{ edgeTypeLabels[edge.type] || edge.type }}</span>
            <span class="text-sm text-neutral-200 truncate flex-1">{{ getNodeById(edge.target)?.text || edge.target }}</span>
          </div>
        </div>
      </div>

      <!-- Входящие связи -->
      <div v-if="incomingEdges.length > 0" class="pt-4 border-t border-neutral-800">
        <h4 class="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
          Входящие связи ({{ incomingEdges.length }})
        </h4>
        <div class="space-y-1">
          <div
            v-for="edge in incomingEdges"
            :key="edge.id"
            class="flex items-center gap-2 p-2 rounded bg-neutral-800/50 cursor-pointer hover:bg-neutral-800 transition-colors"
            @click="navigateToNode(edge.source)"
          >
            <UIcon name="i-lucide-arrow-left" class="w-4 h-4 text-neutral-500" />
            <span class="text-xs text-neutral-400">{{ edgeTypeLabels[edge.type] || edge.type }}</span>
            <span class="text-sm text-neutral-200 truncate flex-1">{{ getNodeById(edge.source)?.text || edge.source }}</span>
          </div>
        </div>
      </div>

      <div class="pt-4 border-t border-neutral-800 space-y-2">
        <UButton
          block
          color="primary"
          variant="soft"
          @click="emit('action', 'edit', node.id)"
        >
          Доработать
        </UButton>

        <UButton
          block
          color="error"
          variant="ghost"
          @click="emit('action', 'delete', node.id)"
        >
          Удалить
        </UButton>
      </div>
    </div>
  </div>
</template>
