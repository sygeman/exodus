<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { useRoute, useRouter } from "vue-router"
import { useProjects } from "@/modules/projects/webview"
import { computed, reactive, watch } from "vue"
import { z } from "zod"
import type { FormSubmitEvent } from "@nuxt/ui"
import MenuLayout, { type MenuLayoutItem } from "@/mainview/components/MenuLayout.vue"
import { PROJECT_COLORS } from "@/modules/projects/constants"

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { projects, update, remove } = useProjects()

const projectId = computed(() => route.params.id as string)
const project = computed(() => projects.value.find((p) => p.id === projectId.value))

const schema = z.object({
  name: z.string().min(1, t("projects.nameRequired")),
  color: z.string().min(1, t("projects.colorRequired")),
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  name: "",
  color: "",
})

watch(
  project,
  (val) => {
    if (val) {
      state.name = val.name
      state.color = val.color
    }
  },
  { immediate: true },
)

const navItems = computed<MenuLayoutItem[]>(() => [
  {
    to: `/project/${projectId.value}/settings`,
    label: t("projects.general"),
    icon: "i-lucide-settings",
  },
])

function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!project.value) return
  update(project.value.id, {
    name: event.data.name,
    color: event.data.color,
  })
}

function handleDelete() {
  if (!project.value) return
  remove(project.value.id)
  router.push("/projects")
}
</script>

<template>
  <div v-if="project" class="flex h-full">
    <MenuLayout :title="t('common.settings')" :items="navItems" main-class="overflow-y-auto p-10">
      <UForm :schema="schema" :state="state" class="mx-auto max-w-2xl space-y-8" @submit="onSubmit">
        <UFormField :label="t('projects.name')" name="name">
          <UInput v-model="state.name" />
        </UFormField>

        <UFormField :label="t('projects.color')" name="color">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in PROJECT_COLORS"
              :key="c"
              type="button"
              class="h-8 w-8 rounded-full transition-transform hover:scale-110 focus:ring-2 focus:ring-[var(--ui-primary)] focus:outline-none"
              :style="{ backgroundColor: c }"
              :class="{ 'ring-2 ring-[var(--ui-primary)]': state.color === c }"
              @click="state.color = c"
            />
          </div>
        </UFormField>

        <div class="flex items-center gap-4 pt-2">
          <UButton type="submit">{{ t("common.save") }}</UButton>

          <UButton type="button" color="error" variant="outline" @click="handleDelete">
            <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
            <span class="ml-2">{{ t("common.delete") }}</span>
          </UButton>
        </div>
      </UForm>
    </MenuLayout>
  </div>

  <div
    v-else
    class="flex h-full flex-col items-center justify-center gap-2 text-[var(--ui-text-muted)]"
  >
    <UIcon name="i-lucide-folder-x" class="h-10 w-10" />
    <p>{{ t("projects.notFound") }}</p>
    <UButton to="/projects" variant="link">{{ t("projects.backToList") }}</UButton>
  </div>
</template>
