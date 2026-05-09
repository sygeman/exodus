<script setup lang="ts">
import { useRoute } from "vue-router"
import { useIdeas } from "@/composables/useIdeas"
import { useEdem } from "@/edem"

const route = useRoute()
const {
  items: ideas,
  update: updateIdeas,
  remove: removeIdeas,
} = useIdeas({ filter: { id: { _eq: route.params.id } } })
const edem = useEdem()

function handleCreateIdea() {
  edem.flows.trigger({ flow_id: "createIdea", projectId: route.params.projectId })
}
</script>

<template>
  <div class="flex h-full flex-col p-6">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-bold">Ideas</h2>
      <UButton size="sm" @click="handleCreateIdea()">
        <UIcon name="i-lucide-plus" />
        <span>New Idea</span>
      </UButton>
    </div>
    <div class="flex flex-col gap-3" v-for="item in ideas" :key="item.id">
      <div
        class="hover:bg-elevated flex items-center gap-3 rounded-lg border p-3 transition-colors"
      >
        <div
          class="text-inverted flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
          :style="{ backgroundColor: getLevelColor(item.level) }"
        >
          {{ item.level }}
        </div>
        <div class="flex flex-col">
          <span class="font-medium">{{ item.title }}</span>
          <span class="text-muted text-sm">{{ item.type }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
