<script setup lang="ts">
import { useT } from "@exodus/edem-vue"

const t = useT()

import { useRoute, useRouter } from "vue-router"
import { computed } from "vue"
import { useIdeas } from "@/hooks"

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)

const { items: ideas } = useIdeas({
  filter: { project_id: { _eq: projectId.value } },
  sort: ["-created_at"],
})

function goToIdeas() {
  router.push(`/project/${projectId.value}/ideas`)
}
</script>

<template>
  <div class="flex h-full flex-col p-6">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button
        class="border-default bg-elevated hover:bg-elevated/80 hover:border-primary flex flex-col gap-2 rounded-lg border p-5 text-left transition-colors"
      >
        <div class="text-muted flex items-center gap-2">
          <UIcon name="i-lucide-lightbulb" class="h-4 w-4" />
          <span class="text-sm font-medium">{{ t({ en: "Ideas", ru: "Идеи" }) }}</span>
        </div>
        <span class="text-3xl font-bold">{{ ideas.length }}</span>
      </button>
    </div>
    <div class="mt-8">
      <h3 class="text-muted mb-3 text-sm font-medium">
        {{ t({ en: "Recent ideas", ru: "Последние идеи" }) }}
      </h3>
      <div class="flex flex-col gap-2" v-for="(item, idx) in ideas.slice(0, 5)" :key="idx">
        <RouterLink
          class="border-default hover:bg-elevated flex items-center gap-3 rounded-lg border p-4 transition-colors"
        >
          <div
            class="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold"
          >
            {{ item.data.level ?? "?" }}
          </div>
          <div class="flex flex-col">
            <span class="font-medium">{{ item.data.title }}</span>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
