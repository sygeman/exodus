<script setup lang="ts">
import { computed, ref, watch } from "vue"
import type { ComponentNode } from "@/project-manifest-schemas"
import { getProjectUiComponentTree, type ProjectUiComponentSourceItem } from "@/project-ui-source"
import {
  getUiNodeAtPath,
  getUiNodeLabel,
  serializeUiNodePath,
  type UiNodePath,
} from "@/project-ui-tree"
import { useT } from "@exodus/edem-vue"
import ProjectUiPreviewNode from "@/components/ProjectUiPreviewNode.vue"

defineOptions({ name: "ProjectUiComponentEditor" })

type UiNodeEntry = {
  node: ComponentNode
  path: UiNodePath
  key: string
  depth: number
  childCount: number
}

defineEmits<{
  saveName: [name: string]
  saveTree: [tree: ComponentNode]
  delete: []
}>()

const props = defineProps<{
  componentItem: ProjectUiComponentSourceItem
}>()

const t = useT()

const tree = computed(() => getProjectUiComponentTree(props.componentItem))
const selectedNodePath = ref<UiNodePath>([])

const nodeEntries = computed<UiNodeEntry[]>(() => {
  const entries: UiNodeEntry[] = []

  function visit(node: ComponentNode, path: UiNodePath, depth: number): void {
    const children = Array.isArray(node.children) ? node.children : []

    entries.push({
      node,
      path,
      key: serializeUiNodePath(path),
      depth,
      childCount: children.length,
    })

    children.forEach((child, index) => visit(child, [...path, index], depth + 1))
  }

  visit(tree.value, [], 0)

  return entries
})

const selectedNode = computed(
  () => getUiNodeAtPath(tree.value, selectedNodePath.value) ?? tree.value,
)

const selectedNodePathLabel = computed(() => serializeUiNodePath(selectedNodePath.value))

const selectedNodePropsPreview = computed(() => stringifyRecord(selectedNode.value.props))
const selectedNodeEventsPreview = computed(() => stringifyRecord(selectedNode.value.events))
const selectedNodeBindingsPreview = computed(() => stringifyRecord(selectedNode.value.bind))

const selectedNodeSummary = computed(() => getNodeChildrenSummary(selectedNode.value))

watch(
  () => props.componentItem.id,
  () => {
    selectedNodePath.value = []
  },
)

watch(tree, (nextTree) => {
  if (!getUiNodeAtPath(nextTree, selectedNodePath.value)) {
    selectedNodePath.value = []
  }
})

function selectNode(path: UiNodePath): void {
  selectedNodePath.value = [...path]
}

function isSelectedNode(path: UiNodePath): boolean {
  return (
    path.length === selectedNodePath.value.length &&
    path.every((segment, index) => segment === selectedNodePath.value[index])
  )
}

function getNodeIcon(entry: UiNodeEntry): string {
  if (entry.path.length === 0) {
    return "i-lucide-box"
  }

  if (Array.isArray(entry.node.children)) {
    return "i-lucide-layers-3"
  }

  if (typeof entry.node.children === "string") {
    return "i-lucide-type"
  }

  return "i-lucide-component"
}

function getNodeChildrenSummary(node: ComponentNode): string {
  if (Array.isArray(node.children)) {
    return t(
      { en: "{count} child nodes", ru: "Дочерних нод: {count}" },
      { count: node.children.length },
    )
  }

  if (typeof node.children === "string") {
    return t({ en: "Text children", ru: "Текстовые children" })
  }

  if (node.children) {
    return t({ en: "Translated text", ru: "Переводимый текст" })
  }

  return t({ en: "No children", ru: "Без children" })
}

function getRecordSize(value: object | undefined): number {
  return value ? Object.keys(value).length : 0
}

function stringifyRecord(value: object | undefined): string {
  return value && Object.keys(value).length > 0 ? JSON.stringify(value, null, 2) : ""
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-3 pb-3">
    <section class="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div
        class="border-default bg-default flex min-h-0 flex-col overflow-hidden rounded-2xl border shadow-sm"
      >
        <div class="min-h-0 flex-1 overflow-auto">
          <ProjectUiPreviewNode :node="tree" :is-root="true" />
        </div>
      </div>

      <aside
        class="border-default bg-default flex min-h-0 flex-col overflow-hidden rounded-2xl border shadow-sm"
      >
        <div class="flex shrink-0 flex-col gap-4 p-4 pb-2">
          <div>
            <div class="mb-2 flex items-start justify-between gap-3">
              <div class="flex min-w-0 flex-wrap items-center gap-2">
                <h3 class="text-base font-semibold">
                  {{ t({ en: "Node inspector", ru: "Инспектор ноды" }) }}
                </h3>
                <UBadge :label="selectedNodePathLabel" color="primary" variant="soft" size="sm" />
              </div>
            </div>
            <p class="text-muted text-xs leading-5">
              {{
                t({
                  en: "Select a layer below to inspect it.",
                  ru: "Выбери слой ниже, чтобы посмотреть детали.",
                })
              }}
            </p>
          </div>
        </div>

        <UScrollArea class="min-h-0 flex-1">
          <div class="flex flex-col gap-4 px-4 pb-4">
            <div class="border-default rounded-2xl border p-3">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-medium">{{ t({ en: "Layers", ru: "Слои" }) }}</p>
                  <p class="text-muted mt-1 text-xs">
                    {{ t({ en: "Component tree", ru: "Дерево компонента" }) }}
                  </p>
                </div>
                <UBadge
                  :label="`${nodeEntries.length}`"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                />
              </div>

              <div class="flex flex-col gap-1">
                <button
                  v-for="entry in nodeEntries"
                  :key="entry.key"
                  class="group flex w-full items-center gap-2 rounded-xl py-2 pr-2 text-left transition-colors"
                  :class="isSelectedNode(entry.path) ? 'bg-primary/5' : 'hover:bg-elevated/60'"
                  :style="{ paddingLeft: `${entry.depth * 14 + 10}px` }"
                  @click="selectNode(entry.path)"
                >
                  <span
                    class="bg-elevated text-muted group-hover:text-default flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors"
                    :class="isSelectedNode(entry.path) ? 'text-primary' : ''"
                  >
                    <UIcon :name="getNodeIcon(entry)" class="h-4 w-4" />
                  </span>

                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">
                      {{ getUiNodeLabel(entry.node) }}
                    </span>
                    <span class="text-muted block truncate font-mono text-xs">
                      {{ entry.key }}
                    </span>
                  </span>

                  <UBadge
                    v-if="entry.childCount > 0"
                    :label="`${entry.childCount}`"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                  />
                </button>
              </div>
            </div>

            <div class="border-default rounded-2xl border p-3">
              <div class="mb-3 flex items-start gap-3">
                <div
                  class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                >
                  <UIcon name="i-lucide-component" class="h-5 w-5" />
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">{{ selectedNode.component }}</p>
                  <p class="text-muted mt-1 text-xs leading-5">{{ selectedNodeSummary }}</p>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-2">
                <div class="bg-elevated/50 rounded-xl p-2">
                  <p class="text-muted text-[10px] tracking-wide uppercase">Props</p>
                  <p class="mt-1 text-sm font-medium">{{ getRecordSize(selectedNode.props) }}</p>
                </div>
                <div class="bg-elevated/50 rounded-xl p-2">
                  <p class="text-muted text-[10px] tracking-wide uppercase">Events</p>
                  <p class="mt-1 text-sm font-medium">{{ getRecordSize(selectedNode.events) }}</p>
                </div>
                <div class="bg-elevated/50 rounded-xl p-2">
                  <p class="text-muted text-[10px] tracking-wide uppercase">Bind</p>
                  <p class="mt-1 text-sm font-medium">{{ getRecordSize(selectedNode.bind) }}</p>
                </div>
              </div>
            </div>

            <div v-if="selectedNodePropsPreview" class="flex flex-col gap-2">
              <p class="text-sm font-medium">Props</p>
              <pre
                class="bg-elevated text-highlighted rounded-xl px-3 py-2 text-xs leading-5 break-words whitespace-pre-wrap"
                >{{ selectedNodePropsPreview }}</pre
              >
            </div>

            <div v-if="selectedNodeEventsPreview" class="flex flex-col gap-2">
              <p class="text-sm font-medium">Events</p>
              <pre
                class="bg-elevated text-highlighted rounded-xl px-3 py-2 text-xs leading-5 break-words whitespace-pre-wrap"
                >{{ selectedNodeEventsPreview }}</pre
              >
            </div>

            <div v-if="selectedNodeBindingsPreview" class="flex flex-col gap-2">
              <p class="text-sm font-medium">Bind</p>
              <pre
                class="bg-elevated text-highlighted rounded-xl px-3 py-2 text-xs leading-5 break-words whitespace-pre-wrap"
                >{{ selectedNodeBindingsPreview }}</pre
              >
            </div>

            <div
              v-if="
                !selectedNodePropsPreview &&
                !selectedNodeEventsPreview &&
                !selectedNodeBindingsPreview
              "
              class="border-default bg-elevated/30 rounded-2xl border p-3"
            >
              <div class="flex items-start gap-3">
                <UIcon name="i-lucide-info" class="text-muted mt-0.5 h-4 w-4" />
                <p class="text-muted text-xs leading-5">
                  {{
                    t({
                      en: "This node has no props, events, or data bindings yet.",
                      ru: "У этой ноды пока нет props, событий или привязок данных.",
                    })
                  }}
                </p>
              </div>
            </div>
          </div>
        </UScrollArea>
      </aside>
    </section>
  </div>
</template>
