<script setup lang="ts">
import MenuLayout, { type MenuLayoutItem } from "@/components/MenuLayout.vue"

defineProps<{
  title: string
  items: MenuLayoutItem[]
  pageTitle: string
}>()
</script>

<template>
  <MenuLayout :title="title" :items="items" main-class="overflow-y-auto p-10">
    <div class="w-full">
      <h1 class="mb-8 text-2xl font-bold">{{ pageTitle }}</h1>
      <slot />
    </div>
  </MenuLayout>
</template>
