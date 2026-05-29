<script setup lang="ts">
import { computed, ref, onErrorCaptured } from "vue"
import type { ComponentNode, Translation } from "@/project-manifest-schemas"
import { serializeUiNodePath, type UiNodePath } from "@/project-ui-tree"
import { PREVIEW_REGISTRY } from "@/components/ProjectUiPreviewRegistry"

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
  if (!sel || sel.length === 0) return false
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

function isValidComponent(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return true
  if (typeof value === "object" || typeof value === "function") return true
  return false
}

const resolvedComponent = computed(() => {
  if (props.node.component === "template") {
    return "div"
  }

  const isHtmlTag = props.node.component[0] === props.node.component[0]?.toLowerCase()
  if (isHtmlTag) {
    return props.node.component
  }

  const fromRegistry = REGISTRY[props.node.component]
  if (isValidComponent(fromRegistry)) {
    return fromRegistry
  }

  return "div"
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

const renderedProps = computed<Record<string, unknown>>(() => {
  const next = { ...props.node.props }

  if (props.node.component === "RouterLink" && typeof next.to !== "string") {
    next.to = "#"
  }

  if (props.node.component === "UInput" && next.modelValue === undefined) {
    next.modelValue = ""
  }

  if (props.node.component === "UTextarea" && next.modelValue === undefined) {
    next.modelValue = ""
  }

  if (props.node.component === "UIcon" && typeof next.name !== "string") {
    next.name = "i-lucide-square"
  }

  if (props.node.component === "UBadge" && next.label === undefined && !props.node.children) {
    next.label = "Badge"
  }

  if (props.node.component === "UButton" && next.label === undefined && !props.node.children) {
    next.label = "Button"
  }

  if (props.node.component === "UProgress" && next.value === undefined) {
    next.value = 50
  }

  if (props.node.component === "USelect" && next.modelValue === undefined) {
    next.modelValue = ""
  }

  if (props.node.component === "USwitch" && next.modelValue === undefined) {
    next.modelValue = false
  }

  if (props.node.component === "UCheckbox" && next.modelValue === undefined) {
    next.modelValue = false
  }

  if (props.node.component === "URadioGroup" && next.modelValue === undefined) {
    next.modelValue = ""
  }

  if (props.node.component === "UInputNumber" && next.modelValue === undefined) {
    next.modelValue = 0
  }

  if (props.node.component === "USlider" && next.modelValue === undefined) {
    next.modelValue = 0
  }

  return next
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

  <component
    v-else
    :is="resolvedComponent"
    v-bind="renderedProps"
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
  </component>
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
