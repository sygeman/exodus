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
          <div class="w-[70%] min-w-0">
            <ACSDGraph
              :nodes="mockNodes"
              :edges="mockEdges"
              @node-select="onNodeSelect"
            />
          </div>
          <div class="w-[30%] border-l border-default overflow-y-auto">
            <ACSDNodePanel
              :node="selectedNode"
              :project-name="project?.name || 'Project'"
              @action="onNodeAction"
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
  </div>
</template>

<script setup lang="ts">
import type { ACSDNode, ACSDEdge } from '~/types/acsd'

const route = useRoute()
const projectId = route.params.id as string

const { useProject, pullProject } = useProjects()
const { data: project, isLoading, isError, error } = useProject(projectId)

function onPull() {
  pullProject.mutate(projectId)
}

// Моковые данные ACSD для демо
const mockNodes: ACSDNode[] = [
  { id: 'L0-1', level: 'L0', type: 'goal', text: 'API-сервис для управления контентом', status: 'exists', position: { x: 0, y: 0 } },
  { id: 'L1-1', level: 'L1', type: 'component', text: 'Модуль авторизации', status: 'exists', position: { x: 0, y: 0 } },
  { id: 'L1-2', level: 'L1', type: 'component', text: 'Модуль контента', status: 'exists', position: { x: 0, y: 0 } },
  { id: 'L2-1', level: 'L2', type: 'goal', text: 'OAuth2 авторизация', status: 'exists', position: { x: 0, y: 0 } },
  { id: 'L2-2', level: 'L2', type: 'goal', text: 'CRUD операции', status: 'gap', position: { x: 0, y: 0 } },
  { id: 'L3-1', level: 'L3', type: 'component', text: 'POST /auth/login', status: 'exists', position: { x: 0, y: 0 } },
]

const mockEdges: ACSDEdge[] = [
  { id: 'e1', source: 'L0-1', target: 'L1-1', type: 'implements' },
  { id: 'e2', source: 'L0-1', target: 'L1-2', type: 'implements' },
  { id: 'e3', source: 'L1-1', target: 'L2-1', type: 'implements' },
  { id: 'e4', source: 'L1-2', target: 'L2-2', type: 'implements' },
  { id: 'e5', source: 'L2-1', target: 'L3-1', type: 'implements' },
]

const selectedNodeId = ref<string | null>(null)

const selectedNode = computed(() => {
  if (!selectedNodeId.value) return null
  return mockNodes.find(n => n.id === selectedNodeId.value) || null
})

function onNodeSelect(nodeId: string | null) {
  selectedNodeId.value = nodeId
}

function onNodeAction(action: string, nodeId: string) {
  console.log('Action:', action, 'on node:', nodeId)
}
</script>
