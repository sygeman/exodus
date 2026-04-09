<template>
  <div class="h-screen">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
    </div>

    <!-- Error State -->
    <UAlert
      v-else-if="isError"
      color="error"
      icon="i-lucide-alert-circle"
      :title="'Error loading project'"
      :description="error?.message"
    />

    <!-- Project Details -->
    <template v-else-if="project">
      <div class="h-screen flex flex-col">
        <!-- Header - Full Width -->
        <div class="border-b border-default flex-shrink-0">
          <div class="flex items-center gap-2 px-4 sm:px-6 lg:px-8 py-3">
            <UButton
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="navigateTo('/projects')"
            />
            <h1 class="text-lg font-semibold text-highlighted">{{ project.name }}</h1>
            <div class="flex-1" />
            <UTabs
              v-model="viewMode"
              :items="viewTabs"
              size="sm"
              class="w-auto"
            />
            <UButton
              icon="i-lucide-plus"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="showAddNodeDialog = true"
            >
              Добавить
            </UButton>
            <UButton
              icon="i-lucide-git-pull-arrow"
              color="neutral"
              variant="ghost"
              size="xs"
              :loading="pullProject.isPending.value"
              @click="onPull"
            >
              Pull
            </UButton>
          </div>
        </div>

        <!-- ACSD Graph Layout -->
        <div class="flex-1 flex overflow-hidden">
          <div class="w-[70%] min-w-0 relative">
            <div v-if="isGraphLoading" class="absolute inset-0 flex items-center justify-center bg-elevated/50 z-10">
              <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
            </div>
            <!-- Graph View -->
            <ACSDGraph
              v-if="viewMode === 'graph'"
              :nodes="graphNodes"
              :edges="graphEdges"
              @node-select="onNodeSelect"
            />
            <!-- List View -->
            <ACSDListView
              v-else
              :nodes="graphNodes"
              :selected-node-id="selectedNodeId"
              :scroll-to-node="scrollToNode"
              @node-select="onNodeSelect"
            />
          </div>
          <div class="w-[30%] border-l border-default overflow-y-auto">
            <ACSDNodePanel
              :node="selectedNode"
              :project-name="project?.name || 'Project'"
              :edges="graphEdges"
              :nodes="graphNodes"
              @action="onNodeAction"
              @node-select="onNodeSelectFromPanel"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- Not Found -->
    <UContainer v-else class="py-12">
      <UCard class="text-center py-12">
        <div class="flex justify-center mb-4">
          <UIcon name="i-lucide-file-x" class="w-16 h-16 text-muted" />
        </div>
        <h3 class="text-lg font-medium text-highlighted mb-2">Project not found</h3>
        <p class="text-muted mb-4">The project you're looking for doesn't exist or has been archived.</p>
        <UButton color="primary" @click="navigateTo('/projects')">
          Back to Projects
        </UButton>
      </UCard>
    </UContainer>

    <!-- Диалог добавления ноды -->
    <UModal v-model:open="showAddNodeDialog" title="Добавить элемент">
      <template #body>
        <UTextarea
          v-model="newNodeText"
          placeholder="Опиши элемент..."
          :rows="4"
          class="w-full"
          autofocus
        />
        <p class="text-xs text-muted mt-2">
          Элемент будет создан как draft (без уровня). Уровень можно определить позже.
        </p>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            label="Отмена"
            variant="ghost"
            @click="closeAddNodeDialog"
          />
          <UButton
            label="Создать"
            color="primary"
            :disabled="!newNodeText.trim()"
            :loading="isCreatingNode"
            @click="createNode"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ACSDNode } from '~/types/acsd'

const route = useRoute()
const projectId = route.params.id as string

const { useProject, pullProject } = useProjects()
const { data: project, isLoading, isError, error } = useProject(projectId)

// View mode: 'graph' or 'list'
const viewMode = ref<'graph' | 'list'>('graph')
const viewTabs = [
  { label: 'Graph', icon: 'i-lucide-git-graph', value: 'graph' },
  { label: 'List', icon: 'i-lucide-list', value: 'list' },
]

// Graph data from API
const { nodes: graphNodes, hierarchyEdges: graphEdges, isLoading: isGraphLoading } = useProjectGraph(projectId)

function onPull() {
  pullProject.mutate(projectId)
}

const selectedNodeId = ref<string | null>(null)
const scrollToNode = ref(false)

const selectedNode = computed(() => {
  if (!selectedNodeId.value) return null
  return graphNodes.value.find(n => n.id === selectedNodeId.value) || null
})

function onNodeSelect(nodeId: string | null) {
  scrollToNode.value = false
  selectedNodeId.value = nodeId
}

function onNodeSelectFromPanel(nodeId: string) {
  scrollToNode.value = true
  selectedNodeId.value = nodeId
}

function onNodeAction(action: string, nodeId: string) {
  console.log('Action:', action, 'on node:', nodeId)
}

// Создание ноды
const showAddNodeDialog = ref(false)
const newNodeText = ref('')
const isCreatingNode = ref(false)

function closeAddNodeDialog() {
  showAddNodeDialog.value = false
  newNodeText.value = ''
}

async function createNode() {
  if (!newNodeText.value.trim()) return

  isCreatingNode.value = true
  try {
    // TODO: API для создания ноды пока нет
    // Временно создаём локальную ноду
    const newNode: ACSDNode = {
      id: `draft-${Date.now()}`,
      level: null,
      type: 'component',
      text: newNodeText.value,
      status: 'draft',
      position: { x: 0, y: 0 },
    }

    // Добавляем в локальный массив (нужен API)
    // graphNodes.value.push(newNode)

    closeAddNodeDialog()
  } finally {
    isCreatingNode.value = false
  }
}
</script>
