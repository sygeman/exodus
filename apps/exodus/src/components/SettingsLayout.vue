<script setup lang="ts">
import MenuLayout from "@/components/MenuLayout.vue"

interface MenuLayoutItem {
  to: string
  label: string
  icon: string
}

const props = defineProps<{
  title: string
  items: MenuLayoutItem[]
  pageTitle: string
}>()
</script>

<template>
  <MenuLayout :title="props.title" :items="props.items" main-class="overflow-y-auto p-10">
    <div class="w-full">
      <h1 class="mb-8 text-2xl font-bold">{{ props.pageTitle }}</h1>
      <slot />
    </div>
  </MenuLayout>
</template>
