<script setup lang="ts">
import { computed } from "vue"
import { useRoute } from "vue-router"
import { useT } from "@exodus/edem-vue"
import { useCollectionQuery } from "@/hooks"
import { PROJECT_UI_COMPONENT_SOURCE_COLLECTION } from "@/project-manifest-collections"
import { type ProjectUiComponentSourceItem } from "@/project-ui-source"
import ProjectUiComponentEditor from "@/components/ProjectUiComponentEditor.vue"

const t = useT()
const route = useRoute()
const projectId = computed(() => route.params.id as string)

const { data: components } = useCollectionQuery(PROJECT_UI_COMPONENT_SOURCE_COLLECTION, () => ({
  filter: { project_id: { _eq: projectId.value } },
  sort: ["name"],
}))

const componentItems = computed(() => components.value as unknown as ProjectUiComponentSourceItem[])
const selectedComponent = computed(() => componentItems.value[0] ?? null)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div v-if="!selectedComponent" class="text-muted flex flex-1 items-center justify-center">
      {{ t({ en: "No UI components yet", ru: "Пока нет UI-компонентов" }) }}
    </div>

    <ProjectUiComponentEditor v-else :component-item="selectedComponent" />
  </div>
</template>
