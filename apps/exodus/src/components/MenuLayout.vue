<script setup lang="ts">
import { useRoute } from "vue-router"

export interface MenuLayoutItem {
  to: string
  label: string
  icon: string
}

defineProps<{
  title: string
  items: MenuLayoutItem[]
  mainClass?: string
}>()

const route = useRoute()
</script>

<template>
  <div class="flex h-full w-full">
    <!-- Левая панель -->
    <aside class="border-default flex w-56 flex-col gap-6 border-r p-4">
      <div>
        <h2 class="px-2 text-xl font-bold">{{ title }}</h2>
      </div>

      <nav class="flex flex-col gap-0.5">
        <RouterLink
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          class="text-muted hover:bg-elevated hover:text-default flex items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium transition-colors"
          :class="{
            'bg-[var(--ui-primary)]/10 text-[var(--ui-primary)] hover:bg-[var(--ui-primary)]/10 hover:text-[var(--ui-primary)]':
              route.path === item.to,
          }"
        >
          <UIcon :name="item.icon" class="h-4 w-4" />
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <!-- Правая панель -->
    <main class="w-full flex-1" :class="mainClass">
      <slot />
    </main>
  </div>
</template>
