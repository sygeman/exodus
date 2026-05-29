<script setup lang="ts">
import { computed, ref, onErrorCaptured } from "vue"
import type { ComponentNode, Translation } from "@/project-manifest-schemas"
import { serializeUiNodePath, type UiNodePath } from "@/project-ui-tree"
import { PREVIEW_REGISTRY } from "@/components/ProjectUiPreviewRegistry"
import ProjectUiPreviewRender from "@/components/ProjectUiPreviewRender.vue"

defineOptions({ name: "ProjectUiPreviewNode" })

const props = defineProps<{
  node: ComponentNode
  isRoot?: boolean
  path?: UiNodePath
  selectedPath?: UiNodePath
}>()

const emit = defineEmits<{
  select: [path: UiNodePath]
}>()

const renderError = ref(false)

onErrorCaptured(() => {
  renderError.value = true
  return false
})

const REGISTRY = PREVIEW_REGISTRY as Record<string, unknown>
const KNOWN_DYNAMIC_COMPONENTS = new Set(Object.keys(REGISTRY))

const nodePath = computed<UiNodePath>(() => props.path ?? [])

const isSelected = computed(() => {
  const sel = props.selectedPath
  if (!sel) return false
  const cur = nodePath.value
  return cur.length === sel.length && cur.every((s, i) => s === sel[i])
})

const pathKey = computed(() => serializeUiNodePath(nodePath.value))

const childNodes = computed<ComponentNode[]>(() =>
  Array.isArray(props.node.children) ? props.node.children : [],
)

const textContent = computed(() => {
  if (typeof props.node.children === "string") {
    return props.node.children
  }

  if (isTranslation(props.node.children)) {
    return resolveTranslation(props.node.children)
  }

  return null
})

const showsFallback = computed(() => {
  if (props.node.component === "template") {
    return false
  }

  const isHtmlTag = props.node.component[0] === props.node.component[0]?.toLowerCase()
  if (isHtmlTag) return false
  if (KNOWN_DYNAMIC_COMPONENTS.has(props.node.component)) return false
  return true
})

function isTranslation(value: unknown): value is Translation {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "$type" in value &&
    (value as Record<string, unknown>).$type === "translation"
  )
}

function resolveTranslation(value: Translation): string {
  return (
    value.ru ?? value.en ?? Object.values(value).find((entry) => typeof entry === "string") ?? ""
  )
}

function handleClick(event: MouseEvent): void {
  event.stopPropagation()
  emit("select", nodePath.value)
}
</script>

<template>
  <div
    v-if="renderError"
    class="border-default/60 bg-elevated/30 text-muted rounded-xl border border-dashed px-4 py-6 text-sm"
  >
    {{ node.component }}
  </div>

  <template v-else-if="node.component === 'template'">
    <ProjectUiPreviewNode
      v-for="(child, childIndex) in childNodes"
      :key="`${isRoot ? 'root' : node.component}.${childIndex}`"
      :node="child"
      :path="[...nodePath, childIndex]"
      :selected-path="selectedPath"
      @select="emit('select', $event)"
    />
  </template>

  <ProjectUiPreviewRender
    v-else
    :node="node"
    :data-path="pathKey"
    :class="isSelected ? 'ui-preview-selected' : ''"
    class="ui-preview-node"
    @click="handleClick"
  >
    <template v-if="Array.isArray(node.children)">
      <ProjectUiPreviewNode
        v-for="(child, childIndex) in childNodes"
        :key="`${node.component}.${childIndex}`"
        :node="child"
        :path="[...nodePath, childIndex]"
        :selected-path="selectedPath"
        @select="emit('select', $event)"
      />
    </template>

    <template v-else-if="textContent !== null">
      {{ textContent }}
    </template>

    <template v-else-if="showsFallback">
      <div
        class="border-default/60 bg-elevated/30 text-muted rounded-xl border border-dashed px-4 py-6 text-sm"
      >
        {{ node.component }}
      </div>
    </template>
  </ProjectUiPreviewRender>
</template>

<style scoped>
.ui-preview-node {
  position: relative;
  cursor: pointer;
  outline: 2px solid transparent;
  outline-offset: 2px;
  border-radius: 4px;
  transition:
    outline-color 0.1s ease,
    background-color 0.1s ease;
}

.ui-preview-node:hover {
  outline-color: color-mix(in srgb, var(--ui-primary) 40%, transparent);
}

.ui-preview-node.ui-preview-selected {
  outline-color: color-mix(in srgb, var(--ui-primary) 80%, transparent);
}
</style>
