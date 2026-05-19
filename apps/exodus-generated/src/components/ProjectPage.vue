<script setup lang="ts">
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
const t = useT()

async function goToIdeas($event?: Event, item?: Record<string, unknown>) {
  await router.push(`/project/${route.params.id}/ideas`)
}
</script>

<template>
  <div class="flex h-full flex-col p-6">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button
        class="border-default bg-elevated hover:bg-elevated/80 hover:border-primary flex flex-col gap-2 rounded-lg border p-5 text-left transition-colors"
        @click="goToIdeas($event)"
      >
        <div class="text-muted flex items-center gap-2">
          <UIcon name="i-lucide-lightbulb" class="h-4 w-4" />
          <span class="text-sm font-medium">{{ t({ en: "Ideas", ru: "Идеи" }) }}</span>
        </div>
        <span class="text-3xl font-bold">{{ ideas.length }}</span>
      </button>
    </div>
    <div v-if="ideas.length > 0" class="mt-8">
      <h3 class="text-muted mb-3 text-sm font-medium">
        {{ t({ en: "Recent ideas", ru: "Последние идеи" }) }}
      </h3>
      <div class="flex flex-col gap-2">
        <RouterLink
          v-for="idea in ideas.slice(0, 5)"
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
  </div>
</template>
