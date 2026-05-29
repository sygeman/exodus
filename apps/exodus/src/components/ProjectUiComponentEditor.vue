<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue"
import type { ComponentNode } from "@/project-manifest-schemas"
import { getProjectUiComponentTree, type ProjectUiComponentSourceItem } from "@/project-ui-source"
import {
  getUiNodeAtPath,
  serializeUiNodePath,
  canUiNodeAcceptChildren,
  addUiNodeChild,
  insertUiNodeRelative,
  removeUiNodeAtPath,
  moveUiNode,
  moveUiNodeRelative,
  updateUiNodeAtPath,
  type UiNodePath,
} from "@/project-ui-tree"
import { useT } from "@exodus/edem-vue"
import { edem } from "@/edem"
import ProjectUiPreviewNode from "@/components/ProjectUiPreviewNode.vue"
import { NUI_COMPONENTS, type NuiComponentMeta, type NuiPropMeta } from "@/generated-nuxt-ui-meta"
import { createDefaultUiNode } from "@/project-ui-node-templates"
import ProjectUiAddComponentModal from "@/components/ProjectUiAddComponentModal.vue"

defineOptions({ name: "ProjectUiComponentEditor" })

type UiNodeEntry = {
  node: ComponentNode
  path: UiNodePath
  key: string
  depth: number
  childCount: number
}

const props = defineProps<{
  componentItem: ProjectUiComponentSourceItem
}>()

const t = useT()

const updateSource = `project-ui-editor:${crypto.randomUUID()}`
const suppressAutoSave = ref(false)
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let updateQueue: Promise<void> = Promise.resolve()

const localTree = ref<ComponentNode | null>(null)

const tree = computed(() => localTree.value ?? getProjectUiComponentTree(props.componentItem))
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

const canAcceptChildren = computed(() => canUiNodeAcceptChildren(selectedNode.value))

const selectedNodeIsRoot = computed(() => selectedNodePath.value.length === 0)

const selectedNodeIndex = computed(() => {
  if (selectedNodePath.value.length === 0) return -1
  return selectedNodePath.value[selectedNodePath.value.length - 1]!
})

const selectedNodeSiblingsCount = computed(() => {
  if (selectedNodePath.value.length === 0) return 1
  const parentPath = selectedNodePath.value.slice(0, -1)
  const parent = getUiNodeAtPath(tree.value, parentPath)
  return Array.isArray(parent?.children) ? parent.children.length : 0
})

// --- Sync tree from props ---
watch(
  () => props.componentItem.id,
  () => {
    localTree.value = null
    selectedNodePath.value = []
  },
)

watch(
  () => getProjectUiComponentTree(props.componentItem),
  (nextTree) => {
    if (suppressAutoSave.value) return
    localTree.value = null
    if (!getUiNodeAtPath(nextTree, selectedNodePath.value)) {
      selectedNodePath.value = []
    }
  },
)

// --- Selection ---
function selectNode(path: UiNodePath): void {
  selectedNodePath.value = [...path]
}

function isSelectedNode(path: UiNodePath): boolean {
  return (
    path.length === selectedNodePath.value.length &&
    path.every((segment, index) => segment === selectedNodePath.value[index])
  )
}

// --- Autosave ---
function scheduleSave(nextTree: ComponentNode): void {
  localTree.value = nextTree
  cancelPendingSave()
  saveTimeout = setTimeout(() => {
    void saveToDb(nextTree, props.componentItem.id)
  }, 500)
}

function cancelPendingSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
}

async function saveToDb(nextTree: ComponentNode, componentId: string): Promise<void> {
  const run = updateQueue.then(async () => {
    if (props.componentItem.id === componentId) {
      suppressAutoSave.value = true
    }
    try {
      await edem.data.updateItem({
        item_id: componentId,
        data: { tree: nextTree },
        source: updateSource,
      })
    } catch (error) {
      console.error("[ui-editor] Failed to save tree:", error)
    } finally {
      await nextTick()
      if (props.componentItem.id === componentId) {
        suppressAutoSave.value = false
      }
    }
  })
  updateQueue = run.catch(() => {})
}

// --- Tree mutations ---
function applyTreeMutation(mutator: (tree: ComponentNode) => ComponentNode): void {
  const nextTree = mutator(tree.value)
  scheduleSave(nextTree)
}

function handlePreviewSelect(path: UiNodePath): void {
  selectNode(path)
}

function handleAddNode(nodeFactory: () => ComponentNode): void {
  const newNode = nodeFactory()

  if (canAcceptChildren.value) {
    const result = addUiNodeChild(tree.value, selectedNodePath.value, newNode)
    selectedNodePath.value = result.path
    scheduleSave(result.tree)
  } else if (selectedNodePath.value.length > 0) {
    const result = insertUiNodeRelative(tree.value, selectedNodePath.value, "after", newNode)
    selectedNodePath.value = result.path
    scheduleSave(result.tree)
  } else {
    const result = addUiNodeChild(tree.value, [], newNode)
    selectedNodePath.value = result.path
    scheduleSave(result.tree)
  }
}

const addModalOpen = ref(false)

function handleModalSelect(component: string): void {
  const meta = NUI_COMPONENTS[component]
  if (meta) {
    handleAddNode(() => createNuiNode(meta))
  } else {
    handleAddNode(() => createDefaultUiNode(component))
  }
}

function createNuiNode(meta: NuiComponentMeta): ComponentNode {
  const node: ComponentNode = { component: meta.name }
  if (Object.keys(meta.defaults).length > 0) {
    node.props = { ...meta.defaults }
  }
  if (meta.isContainer) {
    node.children = []
  }
  return node
}

function handleDeleteNode(): void {
  if (selectedNodeIsRoot.value) return
  const result = removeUiNodeAtPath(tree.value, selectedNodePath.value)
  selectedNodePath.value = result.path
  scheduleSave(result.tree)
}

defineExpose({
  addNode: handleAddNode,
  moveNodeRelative: handleMoveNodeRelative,
  nodeEntries,
  selectedNodePath,
  selectNode,
  isSelectedNode,
})

function handleMoveUp(): void {
  if (selectedNodeIsRoot.value) return
  const result = moveUiNode(tree.value, selectedNodePath.value, "up")
  selectedNodePath.value = result.path
  scheduleSave(result.tree)
}

function handleMoveDown(): void {
  if (selectedNodeIsRoot.value) return
  const result = moveUiNode(tree.value, selectedNodePath.value, "down")
  selectedNodePath.value = result.path
  scheduleSave(result.tree)
}

function handleDuplicateNode(): void {
  if (selectedNodeIsRoot.value) return
  const node = getUiNodeAtPath(tree.value, selectedNodePath.value)
  if (!node) return
  const cloned = structuredClone(node)
  const result = insertUiNodeRelative(tree.value, selectedNodePath.value, "after", cloned)
  selectedNodePath.value = result.path
  scheduleSave(result.tree)
}

function handleMoveNodeRelative(
  sourcePath: UiNodePath,
  targetPath: UiNodePath,
  position: "before" | "after" | "inside",
): void {
  if (sourcePath.length === 0) return
  const result = moveUiNodeRelative(tree.value, sourcePath, targetPath, position)
  selectedNodePath.value = result.path
  scheduleSave(result.tree)
}

// --- Props editing ---

type PropEditorEntry = {
  key: string
  meta: NuiPropMeta | null
  currentValue: unknown
  isSet: boolean
}

const componentMeta = computed<NuiComponentMeta | null>(
  () => NUI_COMPONENTS[selectedNode.value.component] ?? null,
)

const propEditorEntries = computed<PropEditorEntry[]>(() => {
  const node = selectedNode.value
  const meta = componentMeta.value
  const entries: PropEditorEntry[] = []
  const seen = new Set<string>()

  // Props from metadata
  if (meta) {
    for (const [key, propMeta] of Object.entries(meta.props)) {
      seen.add(key)
      entries.push({
        key,
        meta: propMeta,
        currentValue: node.props?.[key],
        isSet: node.props !== undefined && key in node.props,
      })
    }
  }

  // Custom props not in metadata
  if (node.props) {
    for (const key of Object.keys(node.props)) {
      if (!seen.has(key)) {
        entries.push({
          key,
          meta: null,
          currentValue: node.props[key],
          isSet: true,
        })
      }
    }
  }

  return entries
})

function handleSetProp(key: string, value: unknown): void {
  applyTreeMutation((currentTree) =>
    updateUiNodeAtPath(currentTree, selectedNodePath.value, (node) => ({
      ...node,
      props: { ...node.props, [key]: value },
    })),
  )
}

function handleUnsetProp(key: string): void {
  applyTreeMutation((currentTree) =>
    updateUiNodeAtPath(currentTree, selectedNodePath.value, (node) => {
      const nextProps = { ...node.props }
      delete nextProps[key]
      return { ...node, props: Object.keys(nextProps).length > 0 ? nextProps : undefined }
    }),
  )
}

function handleUpdateProp(key: string, rawValue: string): void {
  handleSetProp(key, parsePropValue(rawValue))
}

function handleUpdateBooleanProp(key: string, value: boolean): void {
  handleSetProp(key, value)
}

function handleUpdateVariantProp(key: string, value: string): void {
  handleSetProp(key, value)
}

// --- Helpers ---
function parsePropValue(raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed === "true") return true
  if (trimmed === "false") return false
  if (trimmed === "null") return null
  if (trimmed === "undefined") return undefined
  if (trimmed !== "" && /^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  return raw
}
</script>

<template>
  <div class="flex min-h-0 flex-1 gap-3 overflow-hidden p-3">
    <!-- Center: Preview -->
    <div
      class="border-default bg-default flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm"
    >
      <div class="min-h-0 flex-1 overflow-auto p-4">
        <ProjectUiPreviewNode
          :node="tree"
          :is-root="true"
          :path="[]"
          :selected-path="selectedNodePath"
          @select="handlePreviewSelect"
        />
      </div>
    </div>

    <!-- Right: Toolbar + Inspector -->
    <div class="flex w-[380px] shrink-0 flex-col gap-3 overflow-hidden">
      <!-- Toolbar -->
      <div
        class="border-default bg-default flex shrink-0 items-center gap-0.5 rounded-xl border px-1.5 py-1.5 shadow-sm"
      >
        <UTooltip :text="t({ en: 'Add component', ru: 'Добавить компонент' })">
          <button
            class="bg-primary text-inverted hover:bg-primary/90 flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            @click="addModalOpen = true"
          >
            <UIcon name="i-lucide-plus" class="h-4 w-4" />
          </button>
        </UTooltip>
        <UTooltip :text="t({ en: 'Move up', ru: 'Выше' })">
          <button
            class="text-muted hover:text-default hover:bg-elevated flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
            :disabled="selectedNodeIsRoot || selectedNodeIndex <= 0"
            @click="handleMoveUp"
          >
            <UIcon name="i-lucide-arrow-up" class="h-4 w-4" />
          </button>
        </UTooltip>
        <UTooltip :text="t({ en: 'Move down', ru: 'Ниже' })">
          <button
            class="text-muted hover:text-default hover:bg-elevated flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
            :disabled="selectedNodeIsRoot || selectedNodeIndex >= selectedNodeSiblingsCount - 1"
            @click="handleMoveDown"
          >
            <UIcon name="i-lucide-arrow-down" class="h-4 w-4" />
          </button>
        </UTooltip>
        <UTooltip :text="t({ en: 'Duplicate', ru: 'Дублировать' })">
          <button
            class="text-muted hover:text-default hover:bg-elevated flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
            :disabled="selectedNodeIsRoot"
            @click="handleDuplicateNode"
          >
            <UIcon name="i-lucide-copy" class="h-4 w-4" />
          </button>
        </UTooltip>
        <UTooltip :text="t({ en: 'Delete', ru: 'Удалить' })">
          <button
            class="text-muted hover:text-destructive hover:bg-destructive/10 flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
            :disabled="selectedNodeIsRoot"
            @click="handleDeleteNode"
          >
            <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
          </button>
        </UTooltip>
      </div>

      <!-- Selected component -->
      <div
        class="border-default bg-default flex shrink-0 items-center gap-3 rounded-2xl border p-3 shadow-sm"
      >
        <div
          class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
        >
          <UIcon name="i-lucide-component" class="h-5 w-5" />
        </div>
        <p class="truncate text-sm font-medium">{{ selectedNode.component }}</p>
      </div>

      <!-- Props -->
      <div
        class="border-default bg-default flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm"
      >
        <UScrollArea class="min-h-0 flex-1 p-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <p class="text-sm font-medium">Props</p>
          </div>

          <div v-if="propEditorEntries.length > 0" class="flex flex-col gap-3">
            <div v-for="entry in propEditorEntries" :key="entry.key" class="flex items-start gap-2">
              <UFormField
                :label="entry.key"
                :description="
                  entry.meta?.description && entry.meta.description !== '/'
                    ? entry.meta.description
                    : undefined
                "
                size="sm"
                class="min-w-0 flex-1"
              >
                <!-- Enum prop → select -->
                <USelect
                  v-if="
                    entry.meta?.type === 'enum' && entry.meta.enum && entry.meta.enum.length > 0
                  "
                  :model-value="String(entry.currentValue ?? entry.meta?.defaultValue ?? '')"
                  :items="entry.meta.enum"
                  size="sm"
                  class="w-full"
                  @update:model-value="handleUpdateVariantProp(entry.key, $event as string)"
                />

                <!-- Boolean prop → switch -->
                <USwitch
                  v-else-if="entry.meta?.type === 'boolean'"
                  :model-value="entry.currentValue === true"
                  size="sm"
                  class="w-full"
                  @update:model-value="handleUpdateBooleanProp(entry.key, $event as boolean)"
                />

                <!-- Number prop -->
                <UInput
                  v-else-if="entry.meta?.type === 'number'"
                  :model-value="String(entry.currentValue ?? '')"
                  type="number"
                  size="sm"
                  class="w-full"
                  @update:model-value="handleUpdateProp(entry.key, $event as string)"
                />

                <!-- String / other → input -->
                <UInput
                  v-else
                  :model-value="String(entry.currentValue ?? '')"
                  size="sm"
                  class="w-full"
                  :placeholder="
                    entry.meta?.defaultValue ? `Default: ${entry.meta.defaultValue}` : ''
                  "
                  @update:model-value="handleUpdateProp(entry.key, $event as string)"
                />
              </UFormField>

              <button
                v-if="entry.isSet"
                class="text-muted hover:text-destructive mt-6 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
                @click="handleUnsetProp(entry.key)"
              >
                <UIcon name="i-lucide-x" class="h-3 w-3" />
              </button>
            </div>
          </div>

          <p v-else class="text-muted text-xs">
            {{ t({ en: "No props available", ru: "Нет доступных пропсов" }) }}
          </p>
        </UScrollArea>
      </div>
    </div>
  </div>

  <ProjectUiAddComponentModal v-model:open="addModalOpen" @select="handleModalSelect" />
</template>
