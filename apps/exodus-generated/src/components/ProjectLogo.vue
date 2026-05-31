<script setup lang="ts">
import { useFileObjectUrl, useT } from "@exodus/edem-vue"
import { edem } from "@/edem"
import { computed, watch } from "vue"

const props = withDefaults(
  defineProps<{
    name: string
    logo?: string | null
    alt?: string
  }>(),
  {
    logo: null,
    alt: undefined,
  },
)

const emit = defineEmits<{
  error: [message: string | null]
}>()

const t = useT()

const logoHash = computed(() => {
  const logo = props.logo
  return typeof logo === "string" && logo.trim() !== "" ? logo : null
})
const initials = computed(() => props.name.slice(0, 2).toUpperCase())
const altText = computed(() => props.alt ?? t({ en: "Project logo", ru: "Логотип проекта" }))
const { url, loading, error } = useFileObjectUrl(edem.data, logoHash)

watch(
  error,
  (message) => {
    emit("error", message)
  },
  { immediate: true },
)
</script>

<template>
  <span class="flex shrink-0 items-center justify-center overflow-hidden">
    <img v-if="url" :src="url" :alt="altText" class="h-full w-full object-cover" />
    <USkeleton v-else-if="loading" class="h-full w-full" />
    <span v-else>{{ initials }}</span>
  </span>
</template>
