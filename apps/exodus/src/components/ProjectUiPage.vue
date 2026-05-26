<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { useRoute, useRouter, type RouteLocationRaw } from "vue-router"
import { useT } from "@exodus/edem-vue"
import { useCollectionQuery } from "@/hooks"
import { PROJECT_UI_COMPONENT_SOURCE_COLLECTION } from "@/project-manifest-collections"
import {
  getProjectUiComponentManifestId,
  getProjectUiComponentName,
  type ProjectUiComponentSourceItem,
} from "@/project-ui-source"
import ProjectUiComponentEditor from "@/components/ProjectUiComponentEditor.vue"

const t = useT()
const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)

const { data: components, loading } = useCollectionQuery(
  PROJECT_UI_COMPONENT_SOURCE_COLLECTION,
  () => ({
    filter: { project_id: { _eq: projectId.value } },
    sort: ["name"],
  }),
)

const componentItems = computed(() => components.value as unknown as ProjectUiComponentSourceItem[])
const selectedComponentId = ref<string | null>(null)
const componentSearch = ref("")
const showSkeleton = ref(false)

let skeletonTimeout: ReturnType<typeof setTimeout> | null = null

const selectedComponent = computed(
  () => componentItems.value.find((item) => item.id === selectedComponentId.value) ?? null,
)

const filteredComponents = computed(() => {
  const query = componentSearch.value.trim().toLowerCase()
  if (query === "") {
    return componentItems.value
  }

  const filtered = componentItems.value.filter((item) => {
    const name = getProjectUiComponentName(item).toLowerCase()
    const manifestId = getProjectUiComponentManifestId(item).toLowerCase()
    return name.includes(query) || manifestId.includes(query)
  })

  if (
    selectedComponent.value &&
    !filtered.some((item) => item.id === selectedComponent.value?.id)
  ) {
    return [selectedComponent.value, ...filtered]
  }

  return filtered
})

function getRouteStringParam(value: unknown): string | null {
  if (typeof value === "string") {
    return value
  }

  if (Array.isArray(value)) {
    return getRouteStringParam(value[0])
  }

  return null
}

function buildUiRouteLocation(componentId: string | null): RouteLocationRaw {
  if (!componentId) {
    return { name: "project-ui", params: { id: projectId.value } }
  }

  return { name: "project-ui-component", params: { id: projectId.value, componentId } }
}

function navigateUiRoute(componentId: string | null, mode: "push" | "replace" = "push"): void {
  const location = buildUiRouteLocation(componentId)
  if (mode === "replace") {
    void router.replace(location).catch(() => {})
    return
  }

  void router.push(location).catch(() => {})
}

function syncRouteToState(): void {
  const routeComponentId = getRouteStringParam(route.params.componentId)

  if (componentItems.value.length === 0) {
    selectedComponentId.value = null

    if (!loading.value && routeComponentId) {
      navigateUiRoute(null, "replace")
    }

    return
  }

  const routeComponent = routeComponentId
    ? componentItems.value.find((item) => item.id === routeComponentId)
    : null
  const targetComponent = routeComponent ?? componentItems.value[0]

  if (!targetComponent) {
    selectedComponentId.value = null
    return
  }

  selectedComponentId.value = targetComponent.id

  if (routeComponentId !== targetComponent.id) {
    navigateUiRoute(targetComponent.id, "replace")
  }
}

function selectComponent(id: string): void {
  selectedComponentId.value = id
  navigateUiRoute(id)
}

watch(
  loading,
  (isLoading) => {
    if (isLoading) {
      skeletonTimeout = setTimeout(() => {
        showSkeleton.value = true
      }, 150)
      return
    }

    if (skeletonTimeout) {
      clearTimeout(skeletonTimeout)
      skeletonTimeout = null
    }

    showSkeleton.value = false
  },
  { immediate: true },
)

watch(
  [
    componentItems,
    loading,
    () => route.params.id,
    () => route.params.componentId,
    () => route.name,
  ],
  syncRouteToState,
  { immediate: true },
)
</script>

<template>
  <div class="bg-elevated/10 flex h-full min-h-0">
    <aside class="flex min-h-0 w-80 shrink-0 p-3 pr-0">
      <div
        class="border-default bg-default flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm"
      >
        <div class="border-default border-b px-3 py-3">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <h1 class="text-sm font-semibold">{{ t({ en: "Components", ru: "Компоненты" }) }}</h1>
              <UBadge
                :label="`${componentItems.length}`"
                color="neutral"
                variant="subtle"
                size="sm"
              />
            </div>
          </div>

          <UInput
            v-model="componentSearch"
            :placeholder="t({ en: 'Search components', ru: 'Поиск компонентов' })"
            class="w-full"
          />
        </div>

        <div v-if="loading && showSkeleton" class="flex flex-1 flex-col gap-2 p-2">
          <div v-for="i in 5" :key="i" class="rounded-xl p-2.5">
            <USkeleton class="mb-2 h-4 w-32" />
            <USkeleton class="h-3 w-24" />
          </div>
        </div>

        <div
          v-else-if="!loading && componentItems.length === 0"
          class="flex flex-1 flex-col items-start justify-center gap-3 px-4 text-left"
        >
          <div class="bg-elevated text-muted flex h-9 w-9 items-center justify-center rounded-xl">
            <UIcon name="i-lucide-panels-top-left" class="h-5 w-5" />
          </div>
          <div>
            <p class="text-sm font-medium">
              {{ t({ en: "No UI components yet", ru: "Пока нет UI-компонентов" }) }}
            </p>
            <p class="text-muted mt-1 text-xs leading-5">
              {{
                t({
                  en: "Components will appear here when they are added to the project.",
                  ru: "Компоненты появятся здесь, когда будут добавлены в проект.",
                })
              }}
            </p>
          </div>
        </div>

        <div
          v-else-if="filteredComponents.length === 0"
          class="flex flex-1 flex-col items-start justify-center gap-3 px-4 text-left"
        >
          <div class="bg-elevated text-muted flex h-9 w-9 items-center justify-center rounded-xl">
            <UIcon name="i-lucide-search-x" class="h-5 w-5" />
          </div>
          <p class="text-muted text-sm leading-5">
            {{
              t({ en: "No components match this search", ru: "По этому поиску ничего не найдено" })
            }}
          </p>
        </div>

        <UScrollArea v-else class="min-h-0 flex-1">
          <div class="flex flex-col gap-1 p-2">
            <button
              v-for="component in filteredComponents"
              :key="component.id"
              class="group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors"
              :class="
                selectedComponentId === component.id
                  ? 'bg-primary/5 text-default'
                  : 'text-default hover:bg-elevated/60'
              "
              @click="selectComponent(component.id)"
            >
              <span
                class="absolute top-2 bottom-2 left-0 w-0.5 rounded-full transition-opacity"
                :class="
                  selectedComponentId === component.id ? 'bg-primary opacity-100' : 'opacity-0'
                "
              />

              <span
                class="bg-elevated text-muted group-hover:text-default flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors"
                :class="selectedComponentId === component.id ? 'text-primary' : ''"
              >
                <UIcon name="i-lucide-component" class="h-4 w-4" />
              </span>

              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">
                  {{ getProjectUiComponentName(component) }}
                </span>
                <span class="text-muted block truncate font-mono text-xs">
                  {{ getProjectUiComponentManifestId(component) }}
                </span>
              </span>
            </button>
          </div>
        </UScrollArea>
      </div>
    </aside>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        v-if="loading && showSkeleton"
        class="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-3 pb-3"
      >
        <USkeleton class="h-full min-h-[420px] w-full rounded-2xl" />
      </div>

      <div
        v-else-if="!selectedComponent"
        class="text-muted flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <UIcon name="i-lucide-square-pen" class="h-10 w-10" />
        <p>
          {{
            t({ en: "Select a component to continue", ru: "Выбери компонент, чтобы продолжить" })
          }}
        </p>
      </div>

      <ProjectUiComponentEditor v-else :component-item="selectedComponent" />
    </div>
  </div>
</template>
