<script setup lang="ts">
import type { ACSDNode } from '~/types/acsd'

const props = defineProps<{
  nodes: ACSDNode[]
  selectedNodeId: string | null
  scrollToNode?: boolean
}>()

const emit = defineEmits<{
  nodeSelect: [nodeId: string | null]
}>()

const listViewRef = ref<HTMLElement | null>(null)
const nodeRefs = ref<Map<string, HTMLElement>>(new Map())
const searchQuery = ref('')

// Фильтр нод по поисковому запросу
const filteredNodes = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.nodes
  }
  const query = searchQuery.value.toLowerCase()
  return props.nodes.filter(node =>
    node.text.toLowerCase().includes(query) ||
    node.id.toLowerCase().includes(query) ||
    (node.type?.toLowerCase().includes(query) ?? false)
  )
})

// Следим за изменением selectedNodeId и скролим к ноде только если scrollToNode=true
watch(() => props.selectedNodeId, (newId) => {
  if (newId && props.scrollToNode && nodeRefs.value.has(newId)) {
    const element = nodeRefs.value.get(newId)
    if (element && listViewRef.value) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
})

function setNodeRef(el: HTMLElement | null, nodeId: string) {
  if (el) {
    nodeRefs.value.set(nodeId, el)
  }
}

const levelOrder = ['draft', 'L0', 'L1', 'L2', 'L3', 'L4'] as const

type Level = typeof levelOrder[number]

const levelLabels: Record<Level, string> = {
  draft: 'Draft',
  L0: 'Vision',
  L1: 'Design',
  L2: 'Specification',
  L3: 'Contract',
  L4: 'Code',
}

const levelColors: Record<Level, string> = {
  draft: 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20 border-dashed',
  L0: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  L1: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  L2: 'bg-green-500/20 text-green-400 border-green-500/30',
  L3: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  L4: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
}

const typeLabels: Record<string, string> = {
  goal: 'Цель',
  component: 'Компонент',
  invariant: 'Инвариант',
  principle: 'Принцип',
  decision: 'Решение',
  constraint: 'Ограничение',
  non_goal: 'Не-цель',
}

const typeColors: Record<string, string> = {
  goal: 'text-amber-400',
  component: 'text-blue-400',
  invariant: 'text-green-400',
  principle: 'text-cyan-400',
  decision: 'text-purple-400',
  constraint: 'text-neutral-400',
  non_goal: 'text-red-400',
}

const statusIcons: Record<string, string> = {
  exists: 'i-lucide-check-circle',
  draft: 'i-lucide-pencil',
  gap: 'i-lucide-help-circle',
}

const statusColors: Record<string, string> = {
  exists: 'text-success',
  draft: 'text-warning',
  gap: 'text-muted',
}

const groupedNodes = computed(() => {
  const groups: Record<Level, ACSDNode[]> = {
    draft: [],
    L0: [],
    L1: [],
    L2: [],
    L3: [],
    L4: [],
  }

  for (const node of filteredNodes.value) {
    const level = node.level as Level || 'draft'
    if (level in groups) {
      groups[level].push(node)
    }
  }

  return groups
})

// Функция для подсветки совпадений в тексте
function highlightText(text: string, query: string): string {
  if (!query.trim()) return text
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi')
  return text.replace(regex, '<mark class="bg-primary/30 text-primary rounded px-0.5">$1</mark>')
}

// Экранирование спецсимволов для RegExp
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function onNodeClick(nodeId: string) {
  if (props.selectedNodeId === nodeId) {
    emit('nodeSelect', null)
  } else {
    emit('nodeSelect', nodeId)
  }
}
</script>

<template>
  <div ref="listViewRef" class="acsd-list-view h-full overflow-y-auto bg-elevated/30">
    <!-- Search Input -->
    <div class="sticky top-0 z-10 bg-elevated/95 backdrop-blur p-4 border-b border-default">
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="Поиск по ID, тексту или типу..."
        size="sm"
        class="w-full"
      />
    </div>

    <div class="space-y-4 p-4">
      <div
        v-for="level in levelOrder"
        :key="level"
        class="level-section"
      >
        <!-- Level Header -->
        <div
          class="level-header flex items-center gap-2 px-3 py-2 rounded-lg mb-2 border"
          :class="levelColors[level]"
        >
          <span class="font-semibold text-sm">{{ levelLabels[level] }}</span>
          <UBadge
            :label="String(groupedNodes[level].length)"
            variant="soft"
            size="sm"
            class="ml-auto"
          />
        </div>

        <!-- Nodes List -->
        <div class="space-y-2 pl-2">
          <div
            v-for="node in groupedNodes[level]"
            :key="node.id"
            :ref="(el) => setNodeRef(el as HTMLElement, node.id)"
            class="node-card p-3 rounded-lg border border-default bg-default cursor-pointer transition-all hover:border-muted"
            :class="{
              'ring-2 ring-primary border-primary': selectedNodeId === node.id,
              'opacity-50 border-dashed': node.status === 'gap',
            }"
            @click="onNodeClick(node.id)"
          >
            <div class="flex items-start gap-2">
              <!-- Status Icon -->
              <UIcon
                :name="statusIcons[node.status]"
                class="w-4 h-4 mt-0.5 shrink-0"
                :class="statusColors[node.status]"
              />

              <div class="flex-1 min-w-0">
                <!-- Type Badge -->
                <div v-if="node.type" class="flex items-center gap-2 mb-1">
                  <span
                    class="text-xs font-medium uppercase tracking-wide"
                    :class="typeColors[node.type]"
                  >
                    {{ typeLabels[node.type] }}
                  </span>
                  <span
                    class="text-xs text-muted"
                    v-html="highlightText(node.id, searchQuery)"
                  />
                </div>
                <div v-else class="flex items-center gap-2 mb-1">
                  <span
                    class="text-xs text-muted"
                    v-html="highlightText(node.id, searchQuery)"
                  />
                </div>

                <!-- Node Text -->
                <p
                  class="text-sm text-highlighted line-clamp-2"
                  v-html="node.level === null ? highlightText(node.text, searchQuery) : node.status === 'gap' ? '[Не определено]' : highlightText(node.text, searchQuery)"
                />
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div
            v-if="groupedNodes[level].length === 0"
            class="text-center py-4 text-muted text-sm"
          >
            Нет элементов
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.acsd-list-view {
  scrollbar-width: thin;
  scrollbar-color: var(--color-neutral-700) transparent;
}

.acsd-list-view::-webkit-scrollbar {
  width: 6px;
}

.acsd-list-view::-webkit-scrollbar-track {
  background: transparent;
}

.acsd-list-view::-webkit-scrollbar-thumb {
  background-color: var(--color-neutral-700);
  border-radius: 3px;
}

.node-card {
  transition: all 0.15s ease;
}

.node-card:hover {
  background-color: var(--color-neutral-800);
}

:deep(mark) {
  background-color: var(--color-primary-500 / 0.3);
  color: var(--color-primary-400);
  border-radius: 2px;
  padding: 0 2px;
}
</style>
