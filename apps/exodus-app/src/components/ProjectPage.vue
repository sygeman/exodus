<script setup lang="ts">
import { useRoute } from "vue-router"
import { useIdeas } from "@/composables/useIdeas"

const route = useRoute()
const {
  items: ideas,
  update: updateIdeas,
  remove: removeIdeas,
} = useIdeas({ filter: { id: { _eq: route.params.id } } })
</script>

<template>
  <div class="flex h-full flex-col p-6">
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        class="hover:bg-elevated flex items-center gap-3 rounded-lg border p-4 transition-colors"
      >
        <UIcon name="i-lucide-lightbulb" class="text-primary" />
        <div class="flex flex-col">
          <span class="text-muted text-sm">Ideas</span>
          <span class="text-2xl font-bold" v-for="item in ideas" :key="item.id">
            <span>{{ item.ideas.length }}</span>
          </span>
        </div>
      </div>
    </div>
    <h3 class="mb-4 font-bold">Recent Ideas</h3>
    <div v-for="item in ideas" :key="item.id">
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
