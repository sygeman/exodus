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
          <div class="w-[70%] min-w-0 relative">
            <div v-if="isGraphLoading" class="absolute inset-0 flex items-center justify-center bg-elevated/50 z-10">
              <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
            </div>
            <ACSDGraph
              :nodes="graphNodes"
              :edges="graphEdges"
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
import type { ACSDNode } from '~/types/acsd'

const route = useRoute()
const projectId = route.params.id as string

const { useProject, pullProject } = useProjects()
const { data: project, isLoading, isError, error } = useProject(projectId)

// Graph data from API
const { nodes: graphNodes, hierarchyEdges: graphEdges, isLoading: isGraphLoading } = useProjectGraph(projectId)

function onPull() {
  pullProject.mutate(projectId)
}

const selectedNodeId = ref<string | null>(null)

const selectedNode = computed(() => {
  if (!selectedNodeId.value) return null
  return graphNodes.value.find(n => n.id === selectedNodeId.value) || null
})

function onNodeSelect(nodeId: string | null) {
  selectedNodeId.value = nodeId
}

function onNodeAction(action: string, nodeId: string) {
  console.log('Action:', action, 'on node:', nodeId)
}
</script>
