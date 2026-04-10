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
            @click="clearIntentParam"
          />
          <h3 class="text-base font-medium text-highlighted">Доработка идеи</h3>
          <UBadge :label="editingNodeId || ''" variant="soft" size="xs" />
        </div>
      </template>
      <template #body>
        <div class="flex h-[calc(100vh-8rem)]">
          <!-- Основная область -->
          <div class="flex-1 flex flex-col overflow-y-auto px-8 py-6">
            <!-- Текущее состояние -->
            <div class="mb-6 p-4 rounded-lg border border-default bg-elevated">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-medium text-muted uppercase tracking-wide">Текущее состояние</span>
              </div>
              <p class="text-base text-highlighted mb-3">{{ mockCurrentNode.text }}</p>
              <div class="flex gap-4 text-xs">
                <span class="text-muted">Уровень:</span>
                <span class="text-highlighted font-medium">{{ mockCurrentNode.level || 'draft' }}</span>
              </div>
              <div class="flex gap-4 text-xs mt-1">
                <span class="text-muted">Тип:</span>
                <span class="text-highlighted font-medium">{{ mockCurrentNode.type || '—' }}</span>
              </div>
              <div class="flex gap-4 text-xs mt-1">
                <span class="text-muted">Связи:</span>
                <span class="text-highlighted font-medium">
                  {{ mockCurrentNode.edges.length ? mockCurrentNode.edges.join(', ') : '—' }}
                </span>
              </div>
            </div>

            <!-- Ввод запроса -->
            <div class="space-y-3">
              <UTextarea
                v-model="intentInput"
                placeholder="Опиши что изменить..."
                :rows="4"
                class="w-full"
                autofocus
              />
              <div class="flex justify-end">
                <UButton
                  label="Предложить"
                  color="primary"
                  :loading="mockLoading"
                  :disabled="!intentInput.trim()"
                  @click="mockSuggest"
                />
              </div>
            </div>

            <!-- Предложение LLM -->
            <div v-if="mockSuggestion" class="mt-6 space-y-4">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-sparkles" class="w-4 h-4 text-primary" />
                <span class="text-sm font-medium text-highlighted">Предложение</span>
              </div>

              <div class="p-4 rounded-lg border border-primary/30 bg-primary/5">
                <p class="text-base text-highlighted mb-3">{{ mockSuggestion.text }}</p>
                <div class="flex gap-4 text-xs mb-2">
                  <span class="text-muted">Уровень:</span>
                  <span class="text-highlighted font-medium">{{ mockSuggestion.level }}</span>
                </div>
                <div class="flex gap-4 text-xs mb-2">
                  <span class="text-muted">Тип:</span>
                  <span class="text-highlighted font-medium">{{ mockSuggestion.type }}</span>
                </div>
                <div class="flex gap-4 text-xs">
                  <span class="text-muted">Связи:</span>
                  <span class="text-highlighted font-medium">{{ mockSuggestion.edges.join(', ') }}</span>
                </div>
              </div>

              <div class="flex gap-2 justify-end">
                <UButton
                  label="Отклонить"
                  variant="ghost"
                  color="neutral"
                  @click="mockSuggestion = null"
                />
                <UButton
                  label="Принять"
                  color="primary"
                  @click="mockAccept"
                />
              </div>
            </div>
          </div>

          <!-- История справа -->
          <div class="w-72 border-l border-default bg-elevated/50 overflow-y-auto">
            <div class="p-4">
              <h4 class="text-xs font-medium text-muted uppercase tracking-wide mb-4">История</h4>
              <div class="space-y-4">
                <div
                  v-for="(version, index) in mockHistory"
                  :key="index"
                  class="relative pl-4 pb-4"
                  :class="{ 'border-l-2 border-primary': version.isCurrent }"
                >
                  <div
                    v-if="index < mockHistory.length - 1"
                    class="absolute left-[-1px] top-8 bottom-0 w-px bg-border"
                  />
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-mono text-muted">v{{ version.version }}</span>
                    <UBadge
                      :label="version.level || 'draft'"
                      :color="version.isCurrent ? 'primary' : 'neutral'"
                      variant="soft"
                      size="xs"
                    />
                    <span v-if="version.isCurrent" class="text-xs text-primary">текущая</span>
                  </div>
                  <p class="text-sm text-highlighted mb-1">{{ version.text }}</p>
                  <div v-if="version.type" class="text-xs text-muted mb-1">
                    {{ version.type }}
                  </div>
                  <div v-if="version.edges.length" class="text-xs text-muted">
                    {{ version.edges.join(', ') }}
                  </div>
                  <UButton
                    v-if="!version.isCurrent"
                    label="Вернуться"
                    variant="ghost"
                    size="xs"
                    class="mt-2"
                    @click="mockRevert(version)"
                  />
                </div>
              </div>
            </div>
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
    setIntentParam(nodeId)
  }
}

// Создание ноды
const showAddNodeDialog = ref(false)
const newNodeText = ref('')

// URL параметр intent
const router = useRouter()
const editingNodeId = computed(() => route.query.intent as string || null)

const showEditDrawer = computed({
  get: () => !!route.query.intent,
  set: (value: boolean) => {
    if (!value) {
      clearIntentParam()
    }
  },
})

function setIntentParam(nodeId: string) {
  router.push({ query: { ...route.query, intent: nodeId } })
}

function clearIntentParam() {
  const { intent, ...rest } = route.query
  router.push({ query: rest })
}

const editingNode = computed(() => {
  if (!editingNodeId.value) return null
  return graphNodes.value.find(n => n.id === editingNodeId.value) || null
})

// === MOCK: Intent UX ===
const intentInput = ref('')
const mockLoading = ref(false)
const mockSuggestion = ref<{
  text: string
  level: string
  type: string
  edges: string[]
} | null>(null)

interface MockVersion {
  version: number
  text: string
  level: string | null
  type: string | null
  edges: string[]
  isCurrent: boolean
}

const mockCurrentNode = computed(() => {
  const node = editingNodeId.value
    ? graphNodes.value.find(n => n.id === editingNodeId.value)
    : null

  return {
    text: node?.text || 'авторизация',
    level: node?.level || null,
    type: node?.type || null,
    edges: [] as string[],
  }
})

const mockHistory = ref<MockVersion[]>([])

watch(editingNodeId, (nodeId) => {
  const node = nodeId ? graphNodes.value.find(n => n.id === nodeId) : null
  mockHistory.value = [
    {
      version: 1,
      text: node?.text || 'авторизация',
      level: node?.level || null,
      type: node?.type || null,
      edges: [] as string[],
      isCurrent: true,
    },
  ]
  mockSuggestion.value = null
  intentInput.value = ''
})

function mockSuggest() {
  if (!intentInput.value.trim()) return

  mockLoading.value = true

  // Мокаем задержку LLM
  setTimeout(() => {
    mockLoading.value = false
    mockSuggestion.value = {
      text: 'OAuth 2.0 flow с поддержкой refresh token и scope management',
      level: 'L2',
      type: 'specification',
      edges: ['requires → L1 Auth', 'requires → L2 Token Storage'],
    }
    intentInput.value = ''
  }, 1200)
}

function mockAccept() {
  if (!mockSuggestion.value) return

  const currentVersion = mockHistory.value.find(v => v.isCurrent)
  if (currentVersion) {
    currentVersion.isCurrent = false
  }

  const newVersion = {
    version: mockHistory.value.length + 1,
    text: mockSuggestion.value.text,
    level: mockSuggestion.value.level,
    type: mockSuggestion.value.type,
    edges: mockSuggestion.value.edges,
    isCurrent: true,
  }

  mockHistory.value.push(newVersion)
  mockSuggestion.value = null
}

function mockRevert(version: MockVersion) {
  const currentVersion = mockHistory.value.find(v => v.isCurrent)
  if (currentVersion) {
    currentVersion.isCurrent = false
  }

  version.isCurrent = true
}

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
