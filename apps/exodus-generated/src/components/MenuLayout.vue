<script setup lang="ts">
import { useRouter } from "vue-router"

const router = useRouter()
</script>

<template>
  <div class="flex h-full w-full">
    <aside class="border-default flex w-56 flex-col gap-6 border-r p-4">
      <div>
        <h2 class="px-2 text-xl font-bold">{{ title }}</h2>
      </div>
      <nav class="flex flex-col gap-0.5">
        <RouterLink
          :to="item.to"
          class="text-muted hover:bg-elevated hover:text-default flex items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium transition-colors"
          v-for="(item, idx) in navItems"
          :key="idx"
        >
          <span class="flex items-center gap-3">
            <UIcon :name="item.icon" class="h-4 w-4" />
            {{ item.label }}
          </span>
        </RouterLink>
      </nav>
    </aside>
    <main class="w-full flex-1">
      <RouterView />
    </main>
  </div>
</template>
