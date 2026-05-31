<script setup lang="ts">
import MenuLayout from "@/components/MenuLayout.vue"

const props = defineProps<{ [key: string]: unknown }>()
</script>

<template>
  <MenuLayout :title="props.title" :items="props.items" main-class="overflow-y-auto p-10">
    <div class="w-full">
      <h1 class="mb-8 text-2xl font-bold">{{ props.pageTitle }}</h1>
      <slot />
    </div>
  </MenuLayout>
</template>
