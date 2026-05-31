<script setup lang="ts">
import { useRoute } from "vue-router"

const route = useRoute()
const props = defineProps<{ [key: string]: unknown }>()
</script>

<template>
  <div class="flex h-full w-full">
    <aside class="border-default flex w-56 flex-col gap-6 border-r p-4">
      <div>
        <h2 class="px-2 text-xl font-bold">{{ props.title }}</h2>
      </div>
      <nav v-for="(item, idx) in props.items" :key="idx" class="flex flex-col gap-0.5">
        <RouterLink
          :to="item.to"
          :class="
            route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to + '/'))
              ? 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary flex items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium transition-colors'
              : 'text-muted hover:bg-elevated hover:text-default flex items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium transition-colors'
          "
        >
          <UIcon :name="item.icon" class="h-4 w-4" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>
    <main class="w-full flex-1" :class="props.mainClass ?? ''">
      <slot />
    </main>
  </div>
</template>
