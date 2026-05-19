<script setup lang="ts">
import { ref } from "vue"
import { useRoute } from "vue-router"
import { useIdeas } from "@/composables/useIdeas"
import { useT } from "@exodus/edem-vue"

const route = useRoute()
const {
  items: ideas,
  loading: ideasLoading,
  create: createIdeas,
  update: updateIdeas,
  remove: removeIdeas,
} = useIdeas({ filter: { project_id: { _eq: route.params.id } }, sort: ["-created_at"] })
const showSkeleton = ref(false)
const t = useT()

async function handleCreate($event?: Event, item?: Record<string, unknown>) {
  const createdIdResult = await createIdeas({
    project_id: route.params.id,
    title: "Untitled",
    status: "draft",
  })
  const createdId = typeof createdIdResult === "string" ? createdIdResult : createdIdResult.id
  await router.push(`/project/${route.params.id}/ideas/${createdId}`)
}
</script>

<template>
  <div class="flex h-full flex-col p-6">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-semibold">{{ t({ en: "Ideas", ru: "Идеи" }) }}</h2>
      <UButton size="sm" @click="handleCreate($event)">
        <UIcon name="i-lucide-plus" class="h-4 w-4" />
        {{ t({ en: "New Idea", ru: "Новая идея" }) }}
      </UButton>
    </div>
    <div v-if="ideasLoading" class="flex flex-col gap-3">
      <div
        v-for="i in 3"
        :key="i"
        class="border-default flex items-center gap-3 rounded-lg border p-4"
      >
        <USkeleton class="h-8 w-8 shrink-0 rounded" />
        <USkeleton class="h-5 w-48" />
      </div>
    </div>
    <div
      v-else-if="!ideasLoading && ideas.length === 0"
      class="text-muted flex flex-1 flex-col items-center justify-center gap-2"
    >
      <UIcon name="i-lucide-lightbulb" class="h-12 w-12 opacity-20" />
      <p class="text-lg">{{ t({ en: "No ideas yet", ru: "Пока нет идей" }) }}</p>
      <UButton size="sm" @click="handleCreate($event)">{{
        t({ en: "Create first idea", ru: "Создать первую идею" })
      }}</UButton>
    </div>
    <div v-else class="flex flex-col gap-2">
      <RouterLink
        v-for="idea in ideas"
        :key="idea.id"
        :to="`/project/${route.params.id}/ideas/${idea.id}`"
        class="border-default hover:bg-elevated flex items-center gap-3 rounded-lg border p-4 transition-colors"
      >
        <div
          class="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold"
        >
          {{ idea.level ?? "?" }}
        </div>
        <div class="flex flex-col">
          <span class="font-medium">{{ idea.title }}</span>
          <span v-if="idea.type" class="text-muted text-xs">{{ idea.type }}</span>
        </div>
        <span
          v-if="idea.status === 'stabilized'"
          class="ml-auto inline-flex h-5 items-center rounded bg-green-500/10 px-1.5 text-xs text-green-500"
          >{{ t({ en: "Stabilized", ru: "Стабилизирована" }) }}</span
        >
      </RouterLink>
    </div>
  </div>
</template>
