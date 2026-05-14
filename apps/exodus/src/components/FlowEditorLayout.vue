<script setup lang="ts">
import { useT } from "@exodus/edem-vue"
import { useCollectionQuery } from "@/hooks"
import { useRoute, useRouter } from "vue-router"
import { computed } from "vue"

const t = useT()
const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const flowId = computed(() => route.params.flowId as string)

const { data: flows } = useCollectionQuery("flows", () => ({
  filter: { project_id: { _eq: projectId.value } },
}))

const flow = computed(() => flows.value.find((f) => f.id === flowId.value))
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-default flex h-12 shrink-0 items-center gap-3 border-b px-6">
      <UButton
        variant="ghost"
        size="xs"
        icon="i-lucide-arrow-left"
        @click="router.push(`/project/${projectId}/flows`)"
      />
      <span v-if="flow" class="font-semibold">{{ flow.data.name }}</span>
      <span
        v-if="flow"
        class="inline-flex h-5 items-center rounded px-1.5 text-xs"
        :class="{
          'bg-gray-500/10 text-gray-500': flow.data.status === 'draft',
          'bg-green-500/10 text-green-500': flow.data.status === 'active',
          'bg-yellow-500/10 text-yellow-500': flow.data.status === 'paused',
        }"
      >
        {{ flow.data.status }}
      </span>

      <div class="flex-1" />

      <nav v-if="flow" class="flex items-center gap-1">
        <RouterLink
          :to="`/project/${projectId}/flows/${flowId}/graph`"
          class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="{
            'text-primary': route.name === 'project-flow-graph',
            'text-muted hover:text-default': route.name !== 'project-flow-graph',
          }"
        >
          <UIcon name="i-lucide-git-branch" class="h-4 w-4" />
          {{ t({ en: "Graph", ru: "Граф" }) }}
        </RouterLink>
        <RouterLink
          :to="`/project/${projectId}/flows/${flowId}/code`"
          class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="{
            'text-primary': route.name === 'project-flow-code',
            'text-muted hover:text-default': route.name !== 'project-flow-code',
          }"
        >
          <UIcon name="i-lucide-code-2" class="h-4 w-4" />
          {{ t({ en: "Code", ru: "Код" }) }}
        </RouterLink>
      </nav>
    </div>

    <div class="flex h-full flex-col overflow-hidden">
      <RouterView />
    </div>
  </div>
</template>
