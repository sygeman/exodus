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
              icon="i-lucide-save"
              color="neutral"
              variant="ghost"
              size="xs"
              :disabled="!diff?.addedNodes?.length && !diff?.removedNodes?.length"
              :loading="commit.isPending.value"
              @click="commit.mutate()"
            >
              Commit
              <span v-if="diff?.addedNodes?.length || diff?.removedNodes?.length" class="ml-1 text-xs opacity-60">
                ({{ (diff?.addedNodes?.length || 0) + (diff?.removedNodes?.length || 0) }})
              </span>
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
          Элемент будет создан как draft. Тип и уровень определяются при стабилизации.
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
            :loading="addNode.isPending.value"
            @click="createNode"
          />
        </div>
      </template>
    </UModal>

    <!-- Модалка доработки идеи -->
    <UModal v-model:open="showEditDrawer" :fullscreen="true">
      <template #header>
        <div class="flex items-center gap-3">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="showEditDrawer = false"
          />
          <div>
            <h3 class="text-base font-medium text-highlighted">Доработка идеи</h3>
            <p v-if="editingNode" class="text-sm text-muted">{{ editingNode.text }}</p>
          </div>
        </div>
      </template>
      <template #body>
        <div class="max-w-2xl mx-auto space-y-6 py-8">
          <div class="space-y-2">
            <h4 class="text-sm font-medium text-highlighted">Опиши что изменить</h4>
            <p class="text-sm text-muted">
              Система доработает идею через intent — уточнит формулировку, добавит контекст, предложит связи.
            </p>
          </div>
          <UTextarea
            placeholder="Например: сделай более конкретным, добавь детали, уточни границы..."
            :rows="6"
            class="w-full"
          />
          <div class="flex justify-end">
            <UButton label="Отправить" color="primary" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
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

// Cascade mutations
const { addNode, removeNode, commit, diff } = useCascadeMutations(projectId)

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
  if (action === 'delete') {
    removeNode.mutate(nodeId)
  }
  if (action === 'edit') {
    editNodeId.value = nodeId
    showEditDrawer.value = true
  }
}

// Создание ноды
const showAddNodeDialog = ref(false)
const newNodeText = ref('')

// Редактирование ноды
const showEditDrawer = ref(false)
const editNodeId = ref<string | null>(null)

const editingNode = computed(() => {
  if (!editNodeId.value) return null
  return graphNodes.value.find(n => n.id === editNodeId.value) || null
})

function closeAddNodeDialog() {
  showAddNodeDialog.value = false
  newNodeText.value = ''
}

function createNode() {
  if (!newNodeText.value.trim()) return

  addNode.mutate(
    {
      level: null,
      text: newNodeText.value,
    },
    {
      onSuccess: () => {
        closeAddNodeDialog()
      },
    }
  )
}
</script>
