<script setup lang="ts">
import { computed } from "vue"
import type { ComponentNode, Translation } from "@/project-manifest-schemas"

defineOptions({ name: "ProjectUiPreviewNode" })

const props = defineProps<{
  node: ComponentNode
  isRoot?: boolean
}>()

const KNOWN_DYNAMIC_COMPONENTS = new Set([
  "RouterLink",
  "UButton",
  "UIcon",
  "UInput",
  "UTextarea",
  "USwitch",
  "USelect",
  "UTooltip",
])

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

const resolvedComponent = computed(() => {
  if (props.node.component === "template") {
    return "div"
  }

  const isHtmlTag = props.node.component[0] === props.node.component[0]?.toLowerCase()
  if (isHtmlTag || KNOWN_DYNAMIC_COMPONENTS.has(props.node.component)) {
    return props.node.component
  }

  return "div"
})

const showsFallback = computed(() => {
  if (props.node.component === "template") {
    return false
  }

  const isHtmlTag = props.node.component[0] === props.node.component[0]?.toLowerCase()
  return !isHtmlTag && !KNOWN_DYNAMIC_COMPONENTS.has(props.node.component)
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
</script>

<template>
  <template v-if="node.component === 'template'">
    <ProjectUiPreviewNode
      v-for="(child, childIndex) in childNodes"
      :key="`${isRoot ? 'root' : node.component}.${childIndex}`"
      :node="child"
    />
  </template>

  <component v-else :is="resolvedComponent" v-bind="renderedProps">
    <template v-if="Array.isArray(node.children)">
      <ProjectUiPreviewNode
        v-for="(child, childIndex) in childNodes"
        :key="`${node.component}.${childIndex}`"
        :node="child"
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
