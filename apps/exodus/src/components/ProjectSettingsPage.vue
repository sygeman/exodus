<script setup lang="ts">
import SettingsLayout from "@/components/SettingsLayout.vue"
import { uploadFile, useFileObjectUrl, useT } from "@exodus/edem-vue"
import { edem } from "@/edem"

const t = useT()

import { useRoute, useRouter } from "vue-router"
import { computed, ref } from "vue"
import { useCollectionQuery, useUpdateItem, useDeleteItem } from "@/hooks"

const route = useRoute()
const router = useRouter()
const { data: projects, loading } = useCollectionQuery("projects")
const [updateItem] = useUpdateItem()
const [deleteItem] = useDeleteItem()

const projectId = computed(() => route.params.id as string)
const project = computed(() => projects.value.find((p) => p.id === projectId.value))
const deleteModalOpen = ref(false)
const logoInput = ref<HTMLInputElement | null>(null)
const logoUploading = ref(false)
const logoError = ref<string | null>(null)
const projectLogoHash = computed(() => {
  const logo = project.value?.data.logo
  return typeof logo === "string" && logo.trim() !== "" ? logo : null
})
const {
  url: logoUrl,
  loading: logoPreviewLoading,
  error: logoPreviewError,
} = useFileObjectUrl(edem.data, projectLogoHash)

const navItems = computed(() => [
  {
    to: `/project/${projectId.value}/settings`,
    label: t({ en: "General", ru: "Общие" }),
    icon: "i-lucide-settings",
  },
])

function updateName(e: FocusEvent | KeyboardEvent) {
  const name = (e.target as HTMLInputElement).value
  if (!project.value || name.trim() === "" || name === project.value.data.name) return
  updateItem(project.value.id, { name })
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

function openLogoPicker() {
  logoInput.value?.click()
}

async function handleLogoFileChange(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return

  const file = input.files?.[0]
  input.value = ""
  if (!file || !project.value) return

  logoError.value = null

  if (!file.type.startsWith("image/")) {
    logoError.value = t({
      en: "Choose an image file.",
      ru: "Выбери файл изображения.",
    })
    return
  }

  logoUploading.value = true
  try {
    const uploaded = await uploadFile(edem.data, { file, name: file.name, mimeType: file.type })
    await updateItem(project.value.id, { logo: uploaded.hash })
  } catch (error) {
    logoError.value = error instanceof Error ? error.message : String(error)
  } finally {
    logoUploading.value = false
  }
}

async function removeLogo() {
  if (!project.value) return

  logoError.value = null
  logoUploading.value = true
  try {
    await updateItem(project.value.id, { logo: null })
  } catch (error) {
    logoError.value = error instanceof Error ? error.message : String(error)
  } finally {
    logoUploading.value = false
  }
}

function openDeleteModal(_event?: Event) {
  deleteModalOpen.value = true
}

function closeDeleteModal(_event?: Event) {
  deleteModalOpen.value = false
}

function confirmDelete(_event?: Event) {
  if (!project.value) return
  deleteItem(project.value.id)
  deleteModalOpen.value = false
  router.push("/projects")
}
</script>

<template>
  <div class="flex h-full">
    <SettingsLayout
      :title="t({ en: 'Settings', ru: 'Настройки' })"
      :items="navItems"
      :page-title="t({ en: 'Project Settings', ru: 'Настройки проекта' })"
      v-if="project"
    >
      <section class="flex flex-col gap-8">
        <div class="border-default flex flex-col gap-4 border-b pb-8">
          <div class="flex flex-col gap-1">
            <h3 class="text-base font-medium">{{ t({ en: "Logo", ru: "Логотип" }) }}</h3>
            <p class="text-muted text-sm">
              {{
                t({
                  en: "Shown next to the project name and used as the project mark.",
                  ru: "Показывается рядом с названием проекта и используется как знак проекта.",
                })
              }}
            </p>
          </div>

          <div class="flex items-center gap-4">
            <div
              class="border-default bg-elevated flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border shadow-sm"
            >
              <img
                v-if="logoUrl"
                :src="logoUrl"
                :alt="t({ en: 'Project logo', ru: 'Логотип проекта' })"
                class="h-full w-full object-cover"
              />
              <USkeleton v-else-if="logoPreviewLoading" class="h-full w-full" />
              <span v-else class="text-muted text-xl font-semibold">
                {{ getInitials(project.data.name ?? "") }}
              </span>
            </div>

            <div class="flex min-w-0 flex-col gap-2">
              <div class="flex flex-wrap gap-2">
                <UButton
                  size="sm"
                  icon="i-lucide-upload"
                  :loading="logoUploading"
                  @click="openLogoPicker"
                >
                  {{
                    projectLogoHash
                      ? t({ en: "Replace logo", ru: "Заменить логотип" })
                      : t({ en: "Upload logo", ru: "Загрузить логотип" })
                  }}
                </UButton>
                <UButton
                  v-if="projectLogoHash"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-x"
                  :disabled="logoUploading"
                  @click="removeLogo"
                >
                  {{ t({ en: "Remove", ru: "Убрать" }) }}
                </UButton>
              </div>

              <p class="text-muted text-xs">
                {{ t({ en: "PNG, JPEG, WebP or SVG image.", ru: "PNG, JPEG, WebP или SVG." }) }}
              </p>
              <p v-if="logoError || logoPreviewError" class="text-error text-xs">
                {{ logoError || logoPreviewError }}
              </p>
            </div>
          </div>

          <input
            ref="logoInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleLogoFileChange"
          />
        </div>

        <div class="border-default flex flex-col gap-4 border-b pb-8">
          <div class="flex flex-col gap-1">
            <h3 class="text-base font-medium">{{ t({ en: "Name", ru: "Название" }) }}</h3>
            <p class="text-muted text-sm">
              {{
                t({
                  en: "Project name is displayed in the list and sidebar.",
                  ru: "Название проекта отображается в списке и боковом меню.",
                })
              }}
            </p>
          </div>
          <UInput
            class="max-w-md"
            :model-value="project.data.name ?? ''"
            @blur="updateName($event)"
            @keyup.enter="updateName($event)"
          />
        </div>
        <div>
          <h3 class="text-error mb-2 text-base font-medium">
            {{ t({ en: "Delete project", ru: "Удаление проекта" }) }}
          </h3>
          <p class="text-muted mb-4 text-sm">
            {{
              t({
                en: "This action cannot be undone. All project data will be permanently deleted.",
                ru: "Это действие нельзя отменить. Все данные проекта будут безвозвратно удалены.",
              })
            }}
          </p>
          <UButton color="error" variant="outline" @click="openDeleteModal($event)">
            <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
            <span class="ml-2">{{ t({ en: "Delete", ru: "Удалить" }) }}</span>
          </UButton>
        </div>
      </section>
      <UModal
        v-model:open="deleteModalOpen"
        :title="t({ en: 'Delete project?', ru: 'Удалить проект?' })"
        :description="
          t({
            en: 'Are you sure you want to delete this project? This action cannot be undone.',
            ru: 'Вы уверены, что хотите удалить этот проект? Это действие необратимо.',
          })
        "
      >
        <template #footer>
          <div class="flex w-full justify-end gap-3">
            <UButton variant="ghost" @click="closeDeleteModal($event)">{{
              t({ en: "Cancel", ru: "Отмена" })
            }}</UButton>
            <UButton color="error" @click="confirmDelete($event)">{{
              t({ en: "Delete", ru: "Удалить" })
            }}</UButton>
          </div>
        </template>
      </UModal>
    </SettingsLayout>
    <div
      class="text-muted flex h-full flex-col items-center justify-center gap-2"
      v-else-if="!loading"
    >
      <UIcon name="i-lucide-folder-x" class="h-10 w-10" />
      <p>{{ t({ en: "Project not found", ru: "Проект не найден" }) }}</p>
      <UButton to="/projects" variant="link">{{
        t({ en: "Back to projects", ru: "Назад к проектам" })
      }}</UButton>
    </div>
  </div>
</template>
