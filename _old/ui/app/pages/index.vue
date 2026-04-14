<template>
  <div class="min-h-screen">
    <UContainer class="py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-highlighted">Dashboard</h1>
        <p class="text-muted mt-1">Welcome to Exodus</p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <!-- Error State -->
      <UAlert
        v-else-if="isError"
        color="error"
        icon="i-lucide-alert-circle"
        :title="'Error loading projects'"
        :description="error?.message"
        class="mb-4"
      />

      <!-- Empty State -->
      <UCard v-else-if="!projects || projects.length === 0" class="text-center py-12">
        <div class="flex justify-center mb-4">
          <UIcon name="i-lucide-folder-open" class="w-16 h-16 text-muted" />
        </div>
        <h3 class="text-lg font-medium text-highlighted mb-2">No projects yet</h3>
        <p class="text-muted mb-4">Create your first project to get started</p>
      </UCard>

      <!-- Recent Activity -->
      <div v-else>
        <h2 class="text-lg font-semibold text-highlighted mb-4">Recent Activity</h2>
        <div class="grid gap-4">
          <UCard
            v-for="project in projects.slice(0, 5)"
            :key="project.id"
            class="hover:shadow-md transition-shadow cursor-pointer"
            @click="navigateTo(`/projects/${project.id}`)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UIcon name="i-lucide-folder-git" class="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 class="font-semibold text-highlighted">{{ project.name }}</h3>
                  <p class="text-sm text-muted">
                    {{ project.gitUrl || 'Local project' }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <UBadge
                  :color="project.status === 'active' ? 'success' : 'neutral'"
                  variant="soft"
                >
                  {{ project.status }}
                </UBadge>
                <UDropdownMenu
                  :items="getProjectActions(project)"
                  :content="{ align: 'end', side: 'bottom' }"
                  @click.stop
                >
                  <UButton
                    icon="i-lucide-more-vertical"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                  />
                </UDropdownMenu>
              </div>
            </div>
            <div class="mt-4 pt-4 border-t border-default flex items-center gap-4 text-sm text-muted">
              <span class="flex items-center gap-1">
                <UIcon name="i-lucide-clock" class="w-4 h-4" />
                Created {{ formatDate(project.createdAt) }}
              </span>
              <span class="flex items-center gap-1">
                <UIcon name="i-lucide-folder" class="w-4 h-4" />
                {{ project.path }}
              </span>
            </div>
          </UCard>
        </div>
      </div>
    </UContainer>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="isDeleteModalOpen" :dismissible="!deleteProject.isPending.value" title="Archive Project" description="Are you sure you want to archive this project? This action cannot be undone.">
      <template #footer>
        <UButton
          color="neutral"
          variant="outline"
          :disabled="deleteProject.isPending.value"
          @click="isDeleteModalOpen = false"
        >
          Cancel
        </UButton>
        <UButton
          color="error"
          :loading="deleteProject.isPending.value"
          @click="confirmDelete"
        >
          Archive
        </UButton>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Project } from '~/composables/useProjectsApi'

const { projects, isLoading, isError, error, deleteProject } = useProjects()

const isDeleteModalOpen = ref(false)
const projectToDelete = ref<Project | null>(null)

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const getProjectActions = (project: Project) => [
  [
    {
      label: 'View Details',
      icon: 'i-lucide-eye',
      onSelect: () => navigateTo(`/projects/${project.id}`),
    },
  ],
  [
    {
      label: 'Archive',
      icon: 'i-lucide-archive',
      color: 'error' as const,
      onSelect: () => {
        projectToDelete.value = project
        isDeleteModalOpen.value = true
      },
    },
  ],
]

const confirmDelete = () => {
  if (!projectToDelete.value) return
  
  deleteProject.mutate(projectToDelete.value.id, {
    onSuccess: () => {
      isDeleteModalOpen.value = false
      projectToDelete.value = null
    },
  })
}
</script>
