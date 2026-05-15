<script setup lang="ts">
import { computed } from "vue"
import { Handle, Position, type NodeProps } from "@vue-flow/core"
import { buildHandleLayout, getNodeIcon, type HandleDef, type VueFlowNodeData } from "@/types/flow"
import NodeWrapper from "./NodeWrapper.vue"
import { useNodeTestMode } from "@/composables/useNodeTestMode"

const props = defineProps<NodeProps<VueFlowNodeData>>()

const { getHandleClass, getHandleIconClass } = useNodeTestMode(
  () => props.data,
  () => props.selected,
)

const sourceHandles = computed<HandleDef[]>(() => {
  if (props.data.handleLayout) {
    return props.data.handleLayout.filter((h) => h.type === "source")
  }
  return buildHandleLayout({
    nodeType: props.data.nodeType,
    config: props.data.config,
    actionType: props.data.actionType,
  }).filter((h) => h.type === "source")
})

const targetHandles = computed<HandleDef[]>(() => {
  if (props.data.handleLayout) {
    return props.data.handleLayout.filter((h) => h.type === "target")
  }
  return buildHandleLayout({
    nodeType: props.data.nodeType,
    config: props.data.config,
    actionType: props.data.actionType,
  }).filter((h) => h.type === "target")
})

const HIDE_TARGET: Record<string, boolean> = {
  trigger: true,
  input: true,
}

const HIDE_SOURCE: Record<string, boolean> = {
  output: true,
}

const hideTarget = computed(
  () => HIDE_TARGET[props.data.nodeType] === true && targetHandles.value.length === 0,
)
const hideSource = computed(() => HIDE_SOURCE[props.data.nodeType] === true)

const icon = computed(() => getNodeIcon(props.data.nodeType, props.data.actionType))

const HANDLE_ICON_MAP: Record<string, string> = {
  check: "i-lucide-check",
  x: "i-lucide-x",
  repeat: "i-lucide-repeat-cw",
  "arrow-right": "i-lucide-arrow-right",
  asterisk: "i-lucide-asterisk",
}

const HANDLE_COLOR_MAP: Record<string, string> = {
  success: "success",
  error: "error",
  info: "info",
  neutral: "neutral",
  primary: "primary",
}
</script>

<template>
  <NodeWrapper
    :id="id"
    :data="data"
    :selected="selected"
    :icon="icon"
    :hide-target-handle="hideTarget"
    :hide-source-handle="hideSource"
  >
    <template #handles>
      <template v-for="h in sourceHandles" :key="h.id ?? 'default'">
        <UTooltip :text="h.label || ''" :popper="{ placement: 'right' }">
          <Handle
            :id="h.id ?? undefined"
            type="source"
            :position="Position.Right"
            :style="{ top: h.top }"
            class="!bg-default !flex !size-3 !items-center !justify-center !border"
            :class="h.id ? getHandleClass(h.id, HANDLE_COLOR_MAP[h.color ?? ''] ?? 'neutral') : ''"
          >
            <template v-if="h.icon">
              <UIcon
                v-if="HANDLE_ICON_MAP[h.icon]"
                :name="HANDLE_ICON_MAP[h.icon]"
                class="size-2"
                :class="
                  h.id ? getHandleIconClass(h.id, HANDLE_COLOR_MAP[h.color ?? ''] ?? 'neutral') : ''
                "
              />
              <span
                v-else
                class="text-[8px] font-bold"
                :class="
                  h.id ? getHandleIconClass(h.id, HANDLE_COLOR_MAP[h.color ?? ''] ?? 'neutral') : ''
                "
                >{{ h.icon }}</span
              >
            </template>
          </Handle>
        </UTooltip>
      </template>
      <template v-for="h in targetHandles" :key="h.id ?? 'default-target'">
        <UTooltip :text="h.label || ''" :popper="{ placement: 'left' }">
          <Handle
            :id="h.id ?? undefined"
            type="target"
            :position="Position.Left"
            :style="{ top: h.top }"
            class="!bg-default !flex !size-3 !items-center !justify-center !border"
            :class="h.id ? getHandleClass(h.id, HANDLE_COLOR_MAP[h.color ?? ''] ?? 'neutral') : ''"
          >
            <template v-if="h.icon">
              <span
                class="text-[8px] font-bold"
                :class="
                  h.id ? getHandleIconClass(h.id, HANDLE_COLOR_MAP[h.color ?? ''] ?? 'neutral') : ''
                "
                >{{ h.icon }}</span
              >
            </template>
          </Handle>
        </UTooltip>
      </template>
    </template>
  </NodeWrapper>
</template>
