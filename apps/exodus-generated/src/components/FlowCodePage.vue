<script setup lang="ts">
import { useRoute } from "vue-router"
import { computed, ref, watch } from "vue"
import { useFlows } from "@/hooks"

const route = useRoute()
const flowId = computed(() => route.params.flowId as string)
const projectId = computed(() => route.params.id as string)

const { items: flows, loading } = useFlows({ filter: { project_id: { _eq: projectId.value } } })
const flow = computed(() => flows.value.find((f) => f.id === flowId.value))

const manifest = computed(() => {
  if (!flow.value) return ""
  return JSON.stringify(flow.value.data, null, 2)
})

const copied = ref(false)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(manifest.value)
    copied.value = true
    if (copyTimeout) clearTimeout(copyTimeout)
    copyTimeout = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {}
}

const showSkeleton = ref(false)
let skeletonTimeout: ReturnType<typeof setTimeout> | null = null

watch(
  loading,
  (isLoading) => {
    if (isLoading) {
      skeletonTimeout = setTimeout(() => {
        showSkeleton.value = true
      }, 150)
    } else {
      if (skeletonTimeout) {
        clearTimeout(skeletonTimeout)
        skeletonTimeout = null
      }
      showSkeleton.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="relative flex flex-1 overflow-hidden">
      <pre class="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">{{ manifest }}</pre>
      <UTooltip
        :text="
          copied ? t({ en: 'Copied!', ru: 'Скопировано!' }) : t({ en: 'Copy', ru: 'Копировать' })
        "
      >
        <UButton
          variant="outline"
          size="xs"
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          class="absolute top-3 right-3"
        />
      </UTooltip>
    </div>
  </div>
</template>
