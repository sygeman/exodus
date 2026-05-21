<script setup lang="ts">
import { useT } from "@exodus/edem-vue"
import { useCollectionQuery, useUpdateItem } from "@/hooks"
import { PROJECT_FLOW_SOURCE_COLLECTION } from "@/flow-collections"
import { createDefaultFlowShape, FlowKind, getFlowKind } from "@/types/flow"
import { validateProjectFlow } from "@/project-flow-validation"
import { useRoute, useRouter } from "vue-router"
import { computed, ref } from "vue"

const t = useT()
const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const flowId = computed(() => route.params.flowId as string)
const [updateItem] = useUpdateItem()

const { data: flows } = useCollectionQuery(PROJECT_FLOW_SOURCE_COLLECTION, () => ({
  filter: { project_id: { _eq: projectId.value } },
}))

const flow = computed(() => flows.value.find((f) => f.id === flowId.value))
const flowKind = computed(() => getFlowKind(flow.value?.data.kind))
const isGraphRoute = computed(() => route.name === "project-flow-graph")
const flowValid = computed(() => flow.value?.data.valid !== false)
const flowValidationErrors = computed(() =>
  Array.isArray(flow.value?.data.validation_errors)
    ? flow.value.data.validation_errors.filter(
        (error): error is string => typeof error === "string",
      )
    : [],
)

const kindItems = [
  { label: "Flow", value: FlowKind.flow },
  { label: "Subflow", value: FlowKind.subflow },
]

const kindChangeModalOpen = ref(false)
const pendingKind = ref<FlowKind | null>(null)

function getSelectStringValue(value: unknown): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return getSelectStringValue(value[0])
  if (typeof value === "object" && value !== null && "value" in value) {
    const next = (value as { value?: unknown }).value
    return typeof next === "string" ? next : null
  }
  return null
}

function changeKind(nextKind: unknown) {
  if (!flow.value) return

  const rawKind = getSelectStringValue(nextKind)
  if (!rawKind) return

  const kind = getFlowKind(rawKind)
  if (kind === flowKind.value) return

  pendingKind.value = kind
  kindChangeModalOpen.value = true
}

function closeKindChangeModal() {
  kindChangeModalOpen.value = false
  pendingKind.value = null
}

function confirmKindChange() {
  if (!flow.value || !pendingKind.value) return

  const kind = pendingKind.value

  const defaults = createDefaultFlowShape(kind)
  const validation = validateProjectFlow({ kind, nodes: defaults.nodes, edges: defaults.edges })
  const currentMeta =
    typeof flow.value.data.meta === "object" && flow.value.data.meta !== null
      ? (flow.value.data.meta as Record<string, unknown>)
      : {}

  updateItem(flow.value.id, {
    kind,
    nodes: defaults.nodes,
    edges: defaults.edges,
    valid: validation.valid,
    validation_errors: validation.errors,
    meta: {
      ...currentMeta,
      selectedNodeId: defaults.nodes[0]?.id,
    },
  })

  closeKindChangeModal()
}
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

      <div v-if="flow && isGraphRoute" class="flex items-center gap-2">
        <USelect
          :model-value="flowKind"
          :items="kindItems"
          value-key="value"
          label-key="label"
          class="w-36"
          size="sm"
          @update:model-value="changeKind"
        />

        <span
          class="inline-flex h-7 items-center rounded-md px-2 text-xs font-medium"
          :class="flowValid ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'"
          :title="flowValidationErrors.join('\n') || undefined"
        >
          {{ flowValid ? "Valid" : `Invalid (${flowValidationErrors.length})` }}
        </span>
      </div>

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
        <RouterLink
          :to="`/project/${projectId}/flows/${flowId}/settings`"
          class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="{
            'text-primary': route.name === 'project-flow-settings',
            'text-muted hover:text-default': route.name !== 'project-flow-settings',
          }"
        >
          <UIcon name="i-lucide-settings" class="h-4 w-4" />
          {{ t({ en: "Settings", ru: "Настройки" }) }}
        </RouterLink>
      </nav>
    </div>

    <div class="flex h-full flex-col overflow-hidden">
      <RouterView />
    </div>

    <UModal
      v-model:open="kindChangeModalOpen"
      :title="t({ en: 'Change flow kind?', ru: 'Сменить тип flow?' })"
      :description="
        pendingKind === FlowKind.subflow
          ? t({
              en: 'All current nodes and edges will be deleted. A new Input -> Output graph will be created.',
              ru: 'Все текущие ноды и связи будут удалены. Будет создан новый граф Input -> Output.',
            })
          : t({
              en: 'All current nodes and edges will be deleted. A new graph with a single trigger will be created.',
              ru: 'Все текущие ноды и связи будут удалены. Будет создан новый граф с одним trigger.',
            })
      "
    >
      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton variant="ghost" @click="closeKindChangeModal()">{{
            t({ en: "Cancel", ru: "Отмена" })
          }}</UButton>
          <UButton color="error" @click="confirmKindChange()">{{
            t({ en: "Delete graph and continue", ru: "Удалить граф и продолжить" })
          }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
