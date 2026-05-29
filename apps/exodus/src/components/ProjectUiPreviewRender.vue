<script setup lang="ts">
import type { ComponentNode } from "@/project-manifest-schemas"
import { PREVIEW_REGISTRY } from "@/components/ProjectUiPreviewRegistry"

defineOptions({ name: "ProjectUiPreviewRender" })

const props = defineProps<{
  node: ComponentNode
}>()

const REGISTRY = PREVIEW_REGISTRY as Record<string, unknown>

function resolveComponent(): string | object {
  const name = props.node.component

  if (name === "template") return "div"

  const isHtmlTag = name[0] === name[0]?.toLowerCase()
  if (isHtmlTag) return name

  const fromRegistry = REGISTRY[name]
  if (fromRegistry !== null && fromRegistry !== undefined) {
    return fromRegistry
  }

  return "div"
}

function buildProps(): Record<string, unknown> {
  const next = { ...props.node.props }
  const name = props.node.component

  if (name === "RouterLink" && typeof next.to !== "string") next.to = "#"
  if (name === "UInput" && next.modelValue === undefined) next.modelValue = ""
  if (name === "UTextarea" && next.modelValue === undefined) next.modelValue = ""
  if (name === "UIcon" && typeof next.name !== "string") next.name = "i-lucide-square"
  if (name === "UBadge" && next.label === undefined && !props.node.children) next.label = "Badge"
  if (name === "UButton" && next.label === undefined && !props.node.children) next.label = "Button"
  if (name === "UProgress" && next.value === undefined) next.value = 50
  if (name === "USelect" && next.modelValue === undefined) next.modelValue = ""
  if (name === "USwitch" && next.modelValue === undefined) next.modelValue = false
  if (name === "UCheckbox" && next.modelValue === undefined) next.modelValue = false
  if (name === "URadioGroup" && next.modelValue === undefined) next.modelValue = ""
  if (name === "UInputNumber" && next.modelValue === undefined) next.modelValue = 0
  if (name === "USlider" && next.modelValue === undefined) next.modelValue = 0

  return next
}
</script>

<template>
  <component :is="resolveComponent()" v-bind="buildProps()">
    <slot />
  </component>
</template>
