<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { useRoute, useRouter } from "vue-router"
import { useProjects } from "@/modules/projects/webview"
import { computed, ref } from "vue"
import SettingsLayout from "@/components/SettingsLayout.vue"
import type { MenuLayoutItem } from "@/components/MenuLayout.vue"
import { PROJECT_COLORS } from "@/modules/projects/constants"
import { useCollectionLabels } from "@/composables/useCollectionLabels"

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { projects, loading, update, remove } = useProjects()
const { fieldLabel } = useCollectionLabels("projects")

const projectId = computed(() => route.params.id as string)
const project = computed(() => projects.value.find((p) => p.id === projectId.value))

const deleteModalOpen = ref(false)

const navItems = computed<MenuLayoutItem[]>(() => [
  {
    to: `/project/${projectId.value}/settings`,
    label: t("projects.general"),
    icon: "i-lucide-settings",
  },
])

function updateName(name: string) {
  if (!project.value || name.trim() === "" || name === project.value.name) return
  update(project.value.id, { name })
}

function updateColor(color: string) {
  if (!project.value || color === project.value.color) return
  update(project.value.id, { color })
}

function openDeleteModal() {
  deleteModalOpen.value = true
}

function confirmDelete() {
  if (!project.value) return
  remove(project.value.id)
  deleteModalOpen.value = false
  router.push("/projects")
}
</script>

<template>
  <div v-if="project" class="flex h-full">
    <SettingsLayout
      :title="t('common.settings')"
      :items="navItems"
      :page-title="t('projects.settingsTitle')"
    >
      <section class="flex flex-col gap-8">
        <div class="flex flex-col gap-4 border-b border-[var(--ui-border)] pb-8">
          <div class="flex flex-col gap-1">
            <h3 class="text-base font-medium">{{ fieldLabel("name") }}</h3>
            <p class="text-sm text-[var(--ui-text-muted)]">{{ t("projects.nameDescription") }}</p>
          </div>
          <UInput
            class="max-w-md"
            :model-value="project?.name ?? ''"
            @blur="(e: FocusEvent) => updateName((e.target as HTMLInputElement).value)"
            @keyup.enter="(e: KeyboardEvent) => updateName((e.target as HTMLInputElement).value)"
          />
        </div>

        <div class="flex flex-col gap-4 border-b border-[var(--ui-border)] pb-8">
          <div class="flex flex-col gap-1">
            <h3 class="text-base font-medium">{{ fieldLabel("color") }}</h3>
            <p class="text-sm text-[var(--ui-text-muted)]">{{ t("projects.colorDescription") }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in PROJECT_COLORS"
              :key="c"
              type="button"
              class="h-8 w-8 rounded-full transition-transform hover:scale-110 focus:ring-2 focus:ring-[var(--ui-primary)] focus:outline-none"
              :style="{ backgroundColor: c }"
              :class="{ 'ring-2 ring-[var(--ui-primary)]': project?.color === c }"
              @click="updateColor(c)"
            />
          </div>
        </div>

        <div>
          <h3 class="mb-2 text-base font-medium text-[var(--ui-error)]">
            {{ t("projects.deleteTitle") }}
          </h3>
          <p class="mb-4 text-sm text-[var(--ui-text-muted)]">
            {{ t("projects.deleteDescription") }}
          </p>
          <UButton color="error" variant="outline" @click="openDeleteModal">
            <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
            <span class="ml-2">{{ t("common.delete") }}</span>
          </UButton>
        </div>
      </section>

      <UModal
        v-model:open="deleteModalOpen"
        :title="t('projects.deleteConfirmTitle')"
        :description="t('projects.deleteConfirmDescription')"
      >
        <template #footer>
          <div class="flex w-full justify-end gap-3">
            <UButton variant="ghost" @click="deleteModalOpen = false">{{
              t("common.cancel")
            }}</UButton>
            <UButton color="error" @click="confirmDelete">{{ t("common.delete") }}</UButton>
          </div>
        </template>
      </UModal>
    </SettingsLayout>
  </div>

  <div
    v-else-if="!loading"
    class="flex h-full flex-col items-center justify-center gap-2 text-[var(--ui-text-muted)]"
  >
    <UIcon name="i-lucide-folder-x" class="h-10 w-10" />
    <p>{{ t("projects.notFound") }}</p>
    <UButton to="/projects" variant="link">{{ t("projects.backToList") }}</UButton>
  </div>
</template>
