<script setup lang="ts">
import { computed, inject, ref, type Ref } from "vue"
import { useT } from "@exodus/edem-vue"
import type {
  DataManifest as ProjectDataManifest,
  ManifestCollection,
  ManifestField,
} from "@/project-manifest-schemas"
import type { ProcedureCatalogModule } from "@/procedure-catalog"
import {
  canMapFieldToTarget,
  findClosestTargetMapping,
  getNodeDisplayLabel,
  isTargetPathSatisfied,
  normalizeFieldKey,
  replaceLiteralMapping,
  replaceSourceMapping,
  targetPathCoversPath,
  type GraphEdge,
  type GraphNode,
  type MapTreeItem,
  type MapNodeMapping,
  type MappableTreeItem,
  type ProjectFlowItem,
  useFlowMapEditorModel,
} from "@/flow-map-editor"

type FlatTreeRow = {
  id: string
  path: string
  label: string
  depth: number
  mappable: boolean
  field: MapTreeItem["field"]
}

type SourceOption = {
  label: string
  value: string
}

type CustomTargetDraft = {
  id: string
  targetSuffix: string
  sourcePath: string | null
}

type FilterRuleDraft = {
  id: string
  fieldPath: string | null
  operator: string
  sourcePath: string | null
}

type FilterRuleView = {
  targetPath: string
  fieldPath: string | null
  operator: string | null
  sourcePath: string
  supported: boolean
}

const FILTER_OPERATOR_DEFS = [
  { value: "_eq", en: "Equals", ru: "Равно", requiresField: true },
  { value: "_neq", en: "Not equal", ru: "Не равно", requiresField: true },
  { value: "_gt", en: "Greater than", ru: "Больше", requiresField: true },
  { value: "_gte", en: "Greater or equal", ru: "Больше или равно", requiresField: true },
  { value: "_lt", en: "Less than", ru: "Меньше", requiresField: true },
  { value: "_lte", en: "Less or equal", ru: "Меньше или равно", requiresField: true },
  { value: "_contains", en: "Contains", ru: "Содержит", requiresField: true },
  { value: "_starts_with", en: "Starts with", ru: "Начинается с", requiresField: true },
  { value: "_ends_with", en: "Ends with", ru: "Заканчивается на", requiresField: true },
  { value: "_in", en: "In list", ru: "В списке", requiresField: true },
  { value: "_between", en: "Between", ru: "Между", requiresField: true },
  { value: "_search", en: "Search", ru: "Поиск", requiresField: false },
] as const

const props = defineProps<{
  open: boolean
  nodeId: string | null
}>()

const emit = defineEmits<{
  "update:open": [boolean]
}>()

const t = useT()

const injectedGraphNodesRef = inject<Ref<GraphNode[]>>("graphNodes")
const injectedGraphEdgesRef = inject<Ref<GraphEdge[]>>("graphEdges")
const injectedProjectFlowsRef = inject<Ref<ProjectFlowItem[]>>("projectFlows")
const injectedProcedureCatalogRef = inject<Ref<ProcedureCatalogModule[]>>("procedureCatalog")
const injectedProjectDataManifestRef =
  inject<Ref<ProjectDataManifest | null>>("projectDataManifest")
const injectedSaveGraph = inject<() => void>("saveGraph")

if (
  !injectedGraphNodesRef ||
  !injectedGraphEdgesRef ||
  !injectedProjectFlowsRef ||
  !injectedProcedureCatalogRef ||
  !injectedProjectDataManifestRef ||
  !injectedSaveGraph
) {
  throw new Error("FlowMapEditorModal requires graph context")
}

const graphNodesRef = injectedGraphNodesRef
const graphEdgesRef = injectedGraphEdgesRef
const projectFlows = injectedProjectFlowsRef
const procedureCatalog = injectedProcedureCatalogRef
const projectDataManifest = injectedProjectDataManifestRef
const saveGraph = injectedSaveGraph

const targetFilter = ref("")
const customTargetDrafts = ref<Record<string, CustomTargetDraft[]>>({})
const filterRuleDrafts = ref<Record<string, FilterRuleDraft[]>>({})
let customTargetDraftId = 0
let filterRuleDraftId = 0

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit("update:open", value),
})

const model = useFlowMapEditorModel({
  nodeId: () => props.nodeId,
  graphNodes: graphNodesRef,
  graphEdges: graphEdgesRef,
  projectFlows,
  procedureCatalog,
  projectDataManifest,
  saveGraph,
})

const sourceLabel = computed(
  () =>
    getNodeDisplayLabel(model.incomingNode.value) ?? t({ en: "No source", ru: "Нет источника" }),
)
const targetLabel = computed(
  () => getNodeDisplayLabel(model.outgoingNode.value) ?? t({ en: "No target", ru: "Нет цели" }),
)

const targetRows = computed(() => flattenTree(model.targetItems.value))

const filteredTargetRows = computed(() => {
  const query = targetFilter.value.trim().toLowerCase()
  if (query === "") {
    return targetRows.value
  }

  return targetRows.value.filter((row) =>
    `${row.path} ${row.field.type}`.toLowerCase().includes(query),
  )
})

function updateMapping(targetPath: string, sourcePath: string | null): void {
  model.replaceMappings(replaceSourceMapping(model.mappings.value, targetPath, sourcePath))
}

function autoMapByName(): void {
  const sourceByKey = new Map<string, MappableTreeItem[]>()
  for (const item of model.sourceMappableItems.value) {
    const key = normalizeFieldKey(item.path)
    const list = sourceByKey.get(key)
    if (list) {
      list.push(item)
      continue
    }

    sourceByKey.set(key, [item])
  }

  const nextMappings = [...model.mappings.value]
  const targets = model.targetMappableItems.value.toSorted(
    (left, right) => right.path.split(".").length - left.path.split(".").length,
  )

  for (const target of targets) {
    if (hasTargetConflict(nextMappings, target.path)) {
      continue
    }

    const source = (sourceByKey.get(normalizeFieldKey(target.path)) ?? []).find((candidate) =>
      canMapFieldToTarget(candidate.field, target.field),
    )
    if (!source) {
      continue
    }

    nextMappings.splice(
      0,
      nextMappings.length,
      ...replaceSourceMapping(nextMappings, target.path, source.path),
    )
  }

  model.replaceMappings(nextMappings)
}

function clearAll(): void {
  model.replaceMappings([])
}

function isTargetCovered(path: string): boolean {
  return isTargetPathSatisfied(model.mappings.value, path)
}

function isTargetMissing(path: string): boolean {
  return model.requiredTargetLeafPaths.value.includes(path) && !isTargetCovered(path)
}

function getCoveringMapping(targetPath: string): MapNodeMapping | null {
  return findClosestTargetMapping(model.mappings.value, targetPath)
}

function getInheritedMappingLabel(targetPath: string): string | null {
  const mapping = getCoveringMapping(targetPath)
  if (!mapping || mapping.targetPath === targetPath || mapping.kind === "literal") {
    return null
  }

  const mappedSourceLabel =
    mapping.sourcePath === ""
      ? null
      : (model.sourcePathLabelMap.value.get(mapping.sourcePath) ?? mapping.sourcePath)
  if (!mappedSourceLabel) {
    return null
  }

  return `${mappedSourceLabel} -> ${mapping.targetPath}`
}

function getSourceOptionsForRow(row: FlatTreeRow): SourceOption[] {
  return model.sourceMappableItems.value
    .filter((item) => canMapFieldToTarget(item.field, row.field))
    .map((item) => ({
      label: `${item.path} · ${item.field.type}`,
      value: item.path,
    }))
}

const customTargetSourceOptions = computed<SourceOption[]>(() =>
  model.sourceMappableItems.value.map((item) => ({
    label: `${item.path} · ${item.field.type}`,
    value: item.path,
  })),
)

const filterRuleSourceOptions = computed<SourceOption[]>(() =>
  model.sourceLeafItems.value.map((item) => ({
    label: `${item.path} · ${item.field.type}`,
    value: item.path,
  })),
)

const availableCollectionOptions = computed<SourceOption[]>(() =>
  (projectDataManifest.value?.collections ?? []).map((collection) => ({
    label: getCollectionDisplayLabel(collection),
    value: collection.id,
  })),
)

function getCollectionOptions(currentValue: string | null): SourceOption[] {
  if (
    !currentValue ||
    availableCollectionOptions.value.some((option) => option.value === currentValue)
  ) {
    return availableCollectionOptions.value
  }

  return [{ label: currentValue, value: currentValue }, ...availableCollectionOptions.value]
}

function isOpenObjectRow(row: FlatTreeRow): boolean {
  return row.mappable && row.field.type === "object" && row.field.children.length === 0
}

function isFilterObjectRow(row: FlatTreeRow): boolean {
  return isOpenObjectRow(row) && (row.path === "filter" || row.path.endsWith(".filter"))
}

function isCollectionIdRow(row: FlatTreeRow): boolean {
  return row.mappable && (row.path === "collection_id" || row.path.endsWith(".collection_id"))
}

function getParentPath(path: string): string {
  const lastDotIndex = path.lastIndexOf(".")
  return lastDotIndex === -1 ? "" : path.slice(0, lastDotIndex)
}

function buildChildPath(parentPath: string, name: string): string {
  return parentPath === "" ? name : `${parentPath}.${name}`
}

function getSiblingTargetPath(path: string, siblingName: string): string {
  return buildChildPath(getParentPath(path), siblingName)
}

function getFilterCollectionTargetPath(filterPath: string): string {
  return getSiblingTargetPath(filterPath, "collection_id")
}

function getExactMapping(targetPath: string): MapNodeMapping | null {
  return model.mappings.value.find((mapping) => mapping.targetPath === targetPath) ?? null
}

function getLiteralStringValue(targetPath: string): string | null {
  const mapping = getExactMapping(targetPath)
  return mapping?.kind === "literal" && typeof mapping.literal === "string" ? mapping.literal : null
}

function updateLiteralMapping(targetPath: string, literal: string | null): void {
  model.replaceMappings(replaceLiteralMapping(model.mappings.value, targetPath, literal))
}

function getManifestCollectionById(collectionId: string | null): ManifestCollection | null {
  if (!collectionId) {
    return null
  }

  return (
    projectDataManifest.value?.collections.find((collection) => collection.id === collectionId) ??
    null
  )
}

function getSelectedCollectionIdForFilterPath(filterPath: string): string | null {
  return getLiteralStringValue(getFilterCollectionTargetPath(filterPath))
}

function getSelectedCollectionForFilterPath(filterPath: string): ManifestCollection | null {
  return getManifestCollectionById(getSelectedCollectionIdForFilterPath(filterPath))
}

function getCollectionDisplayLabel(collection: ManifestCollection): string {
  return collection.name === collection.id ? collection.id : `${collection.name} · ${collection.id}`
}

function getManifestFieldLabel(field: ManifestField): string {
  return field.name
}

function getAllowedFilterOperatorsForFieldType(type: ManifestField["type"]): string[] {
  switch (type) {
    case "string":
    case "text":
      return ["_eq", "_neq", "_contains", "_starts_with", "_ends_with", "_in", "_search"]
    case "number":
    case "sort":
      return ["_eq", "_neq", "_gt", "_gte", "_lt", "_lte", "_in", "_between", "_search"]
    case "boolean":
      return ["_eq", "_neq", "_search"]
    case "date":
    case "datetime":
    case "timestamp":
      return ["_eq", "_neq", "_contains", "_starts_with", "_ends_with", "_in", "_search"]
    case "uuid":
    case "file":
    case "image":
    case "video":
    case "relation":
    case "collection":
    case "user":
      return ["_eq", "_neq", "_in", "_search"]
    case "json":
    default:
      return ["_search"]
  }
}

function getCollectionFieldOptionsForFilterPath(filterPath: string): SourceOption[] {
  const collection = getSelectedCollectionForFilterPath(filterPath)
  if (!collection) {
    return []
  }

  return collection.fields
    .filter((field) =>
      getAllowedFilterOperatorsForFieldType(field.type).some((operator) => operator !== "_search"),
    )
    .map((field) => ({
      label: `${getManifestFieldLabel(field)} · ${field.type}`,
      value: field.name,
    }))
    .toSorted((left, right) => left.label.localeCompare(right.label))
}

function getCollectionFieldForFilterPath(
  filterPath: string,
  fieldPath: string | null,
): ManifestField | null {
  if (!fieldPath) {
    return null
  }

  return (
    getSelectedCollectionForFilterPath(filterPath)?.fields.find(
      (field) => field.name === fieldPath,
    ) ?? null
  )
}

function getFilterOperatorOptionsForField(
  filterPath: string,
  fieldPath: string | null,
): SourceOption[] {
  const field = getCollectionFieldForFilterPath(filterPath, fieldPath)
  const allowedValues = field
    ? getAllowedFilterOperatorsForFieldType(field.type)
    : FILTER_OPERATOR_DEFS.map((option) => option.value)

  return FILTER_OPERATOR_DEFS.filter((option) => allowedValues.includes(option.value)).map(
    (option) => ({
      label: t({ en: option.en, ru: option.ru }),
      value: option.value,
    }),
  )
}

function getFilterOperatorDef(value: string) {
  return FILTER_OPERATOR_DEFS.find((option) => option.value === value) ?? null
}

function buildFilterTargetPath(
  parentPath: string,
  fieldPath: string | null,
  operator: string,
): string | null {
  if (operator === "_search") {
    return `${parentPath}._search`
  }

  const normalizedFieldPath = normalizeTargetSuffix(fieldPath ?? "")
  if (normalizedFieldPath === "") {
    return null
  }

  return `${parentPath}.${normalizedFieldPath}.${operator}`
}

function parseFilterRule(parentPath: string, mapping: MapNodeMapping): FilterRuleView {
  const relative = getRelativeTargetPath(parentPath, mapping.targetPath)
  if (relative === "_search") {
    return {
      targetPath: mapping.targetPath,
      fieldPath: null,
      operator: "_search",
      sourcePath: mapping.sourcePath,
      supported: true,
    }
  }

  const segments = relative.split(".").filter((segment) => segment !== "")
  if (segments.length >= 2) {
    const operator = segments[segments.length - 1]
    if (getFilterOperatorDef(operator)) {
      return {
        targetPath: mapping.targetPath,
        fieldPath: segments.slice(0, -1).join("."),
        operator,
        sourcePath: mapping.sourcePath,
        supported: true,
      }
    }
  }

  return {
    targetPath: mapping.targetPath,
    fieldPath: relative,
    operator: null,
    sourcePath: mapping.sourcePath,
    supported: false,
  }
}

function getFilterRules(parentPath: string): FilterRuleView[] {
  return getCustomTargetMappings(parentPath).map((mapping) => parseFilterRule(parentPath, mapping))
}

function updateExistingFilterRule(
  parentPath: string,
  currentTargetPath: string,
  input: {
    fieldPath: string | null
    operator: string
    sourcePath: string | null
  },
): void {
  if (input.sourcePath === null) {
    removeExactMapping(currentTargetPath)
    return
  }

  const nextTargetPath = buildFilterTargetPath(parentPath, input.fieldPath, input.operator)
  if (!nextTargetPath) {
    return
  }

  const nextMappings = model.mappings.value.filter(
    (mapping) => mapping.targetPath !== currentTargetPath,
  )
  model.replaceMappings(replaceSourceMapping(nextMappings, nextTargetPath, input.sourcePath))
}

function getFilterRuleDraftList(parentPath: string): FilterRuleDraft[] {
  return filterRuleDrafts.value[parentPath] ?? []
}

function addFilterRuleDraft(parentPath: string): void {
  filterRuleDraftId += 1
  const next = filterRuleDrafts.value[parentPath] ?? []
  filterRuleDrafts.value = {
    ...filterRuleDrafts.value,
    [parentPath]: [
      ...next,
      {
        id: `filter-rule-${filterRuleDraftId}`,
        fieldPath: null,
        operator: "_eq",
        sourcePath: null,
      },
    ],
  }
}

function updateFilterRuleDraft(
  parentPath: string,
  draftId: string,
  patch: Partial<Pick<FilterRuleDraft, "fieldPath" | "operator" | "sourcePath">>,
): void {
  const next = getFilterRuleDraftList(parentPath).map((draft) =>
    draft.id === draftId ? { ...draft, ...patch } : draft,
  )
  filterRuleDrafts.value = {
    ...filterRuleDrafts.value,
    [parentPath]: next,
  }
}

function removeFilterRuleDraft(parentPath: string, draftId: string): void {
  const next = getFilterRuleDraftList(parentPath).filter((draft) => draft.id !== draftId)
  filterRuleDrafts.value = {
    ...filterRuleDrafts.value,
    [parentPath]: next,
  }
}

function saveFilterRuleDraft(parentPath: string, draftId: string): void {
  const draft = getFilterRuleDraftList(parentPath).find((entry) => entry.id === draftId)
  if (!draft || !draft.sourcePath) {
    return
  }

  const targetPath = buildFilterTargetPath(parentPath, draft.fieldPath, draft.operator)
  if (!targetPath) {
    return
  }

  updateMapping(targetPath, draft.sourcePath)
  removeFilterRuleDraft(parentPath, draftId)
}

function canSaveFilterRuleDraft(parentPath: string, draft: FilterRuleDraft): boolean {
  if (draft.sourcePath === null) {
    return false
  }

  return buildFilterTargetPath(parentPath, draft.fieldPath, draft.operator) !== null
}

function getCustomTargetMappings(parentPath: string): MapNodeMapping[] {
  return model.mappings.value
    .filter(
      (mapping) =>
        mapping.kind !== "literal" &&
        mapping.sourcePath !== "" &&
        mapping.targetPath.startsWith(`${parentPath}.`),
    )
    .toSorted((left, right) => left.targetPath.localeCompare(right.targetPath))
}

function getCustomTargetDraftList(parentPath: string): CustomTargetDraft[] {
  return customTargetDrafts.value[parentPath] ?? []
}

function addCustomTargetDraft(parentPath: string): void {
  const next = customTargetDrafts.value[parentPath] ?? []
  customTargetDraftId += 1
  customTargetDrafts.value = {
    ...customTargetDrafts.value,
    [parentPath]: [
      ...next,
      {
        id: `draft-${customTargetDraftId}`,
        targetSuffix: "",
        sourcePath: null,
      },
    ],
  }
}

function updateCustomTargetDraft(
  parentPath: string,
  draftId: string,
  patch: Partial<Pick<CustomTargetDraft, "targetSuffix" | "sourcePath">>,
): void {
  const next = getCustomTargetDraftList(parentPath).map((draft) =>
    draft.id === draftId ? { ...draft, ...patch } : draft,
  )
  customTargetDrafts.value = {
    ...customTargetDrafts.value,
    [parentPath]: next,
  }
}

function removeCustomTargetDraft(parentPath: string, draftId: string): void {
  const next = getCustomTargetDraftList(parentPath).filter((draft) => draft.id !== draftId)
  customTargetDrafts.value = {
    ...customTargetDrafts.value,
    [parentPath]: next,
  }
}

function normalizeTargetSuffix(value: string): string {
  return value
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "")
    .join(".")
}

function saveCustomTargetDraft(parentPath: string, draftId: string): void {
  const draft = getCustomTargetDraftList(parentPath).find((entry) => entry.id === draftId)
  if (!draft || !draft.sourcePath) {
    return
  }

  const targetSuffix = normalizeTargetSuffix(draft.targetSuffix)
  if (targetSuffix === "") {
    return
  }

  updateMapping(`${parentPath}.${targetSuffix}`, draft.sourcePath)
  removeCustomTargetDraft(parentPath, draftId)
}

function removeExactMapping(targetPath: string): void {
  model.replaceMappings(model.mappings.value.filter((mapping) => mapping.targetPath !== targetPath))
}

function getRelativeTargetPath(parentPath: string, targetPath: string): string {
  const prefix = `${parentPath}.`
  return targetPath.startsWith(prefix) ? targetPath.slice(prefix.length) : targetPath
}

function hasTargetConflict(mappings: MapNodeMapping[], targetPath: string): boolean {
  return mappings.some(
    (mapping) =>
      targetPathCoversPath(mapping.targetPath, targetPath) ||
      targetPathCoversPath(targetPath, mapping.targetPath),
  )
}

function flattenTree(items: MapTreeItem[]): FlatTreeRow[] {
  const rows: FlatTreeRow[] = []

  function walk(itemList: MapTreeItem[], depth: number): void {
    for (const item of itemList) {
      rows.push({
        id: item.id,
        path: item.path,
        label: item.label,
        depth,
        mappable: item.mappable,
        field: item.field,
      })

      if (item.children) {
        walk(item.children, depth + 1)
      }
    }
  }

  walk(items, 0)
  return rows
}

function getSelectStringValue(value: unknown): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return getSelectStringValue(value[0])
  if (typeof value === "object" && value !== null && "value" in value) {
    const next = (value as { value?: unknown }).value
    return typeof next === "string" ? next : null
  }
  return null
}
</script>

<template>
  <UModal
    v-model:open="openModel"
    scrollable
    :ui="{
      content:
        'w-[min(1100px,calc(100vw-2rem))] max-w-none divide-y-0 divide-transparent rounded-2xl',
      header: 'items-start gap-4 px-6 py-5',
      body: 'p-0',
    }"
  >
    <template #header>
      <div
        class="flex min-w-0 flex-1 flex-col gap-4 pr-12 lg:flex-row lg:items-start lg:justify-between"
      >
        <div class="min-w-0 flex-1">
          <p class="text-lg font-semibold">
            {{ t({ en: "Field Mapping", ru: "Сопоставление полей" }) }}
          </p>
          <p class="text-muted mt-1 font-mono text-sm">{{ sourceLabel }} -> {{ targetLabel }}</p>
          <p class="text-muted mt-2 text-xs">
            {{
              t(
                { en: "{mapped}/{total} mapped", ru: "{mapped}/{total} сопоставлено" },
                { mapped: model.mappedTargetCount.value, total: model.totalTargetCount.value },
              )
            }}
            <span v-if="model.missingRequiredCount.value > 0">
              ·
              {{
                t(
                  { en: "{n} required missing", ru: "{n} обязательных не заполнено" },
                  { n: model.missingRequiredCount.value },
                )
              }}
            </span>
          </p>
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <UButton color="neutral" variant="soft" size="sm" @click="autoMapByName">
            {{ t({ en: "Auto-map", ru: "Автосопоставить" }) }}
          </UButton>
          <UButton color="error" variant="ghost" size="sm" @click="clearAll">
            {{ t({ en: "Clear", ru: "Очистить" }) }}
          </UButton>
        </div>
      </div>
    </template>

    <template #body>
      <div class="bg-elevated/10 space-y-4 px-6 py-5">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="min-w-0">
            <p class="text-sm">
              {{
                t({
                  en: "Choose a source field for each target field.",
                  ru: "Выберите поле источника для каждого целевого поля.",
                })
              }}
            </p>
            <p class="text-muted mt-1 font-mono text-xs">
              {{
                t(
                  {
                    en: "{source} source fields · {target} target fields",
                    ru: "{source} полей источника · {target} целевых полей",
                  },
                  {
                    source: model.sourceMappableItems.value.length,
                    target: model.targetMappableItems.value.length,
                  },
                )
              }}
            </p>
          </div>

          <UInput
            v-model="targetFilter"
            color="neutral"
            variant="soft"
            size="sm"
            :placeholder="t({ en: 'Filter target fields', ru: 'Фильтр целевых полей' })"
            class="w-full lg:w-80"
          />
        </div>

        <div
          v-if="model.targetItems.value.length === 0"
          class="text-muted bg-default/80 rounded-2xl p-5 text-sm shadow-sm"
        >
          {{
            t({
              en: "Connect this mapper to a typed node such as a call to inspect its input.",
              ru: "Подключите этот маппер к типизированной ноде, например call, чтобы увидеть её вход.",
            })
          }}
        </div>

        <div
          v-else-if="filteredTargetRows.length === 0"
          class="text-muted bg-default/80 rounded-2xl p-5 text-sm shadow-sm"
        >
          {{
            t({
              en: "No target fields match the current filter.",
              ru: "Нет целевых полей, подходящих под текущий фильтр.",
            })
          }}
        </div>

        <div v-else class="space-y-3">
          <div
            v-if="model.sourceItems.value.length === 0"
            class="text-muted bg-default/80 rounded-2xl p-5 text-sm shadow-sm"
          >
            {{
              t({
                en: "Connect a node before this mapper to inspect its output.",
                ru: "Подключите ноду перед маппером, чтобы увидеть её выход.",
              })
            }}
          </div>

          <div
            v-for="row in filteredTargetRows"
            :key="row.id"
            class="rounded-2xl p-4 transition-colors"
            :class="[
              row.mappable ? 'bg-default/80 shadow-sm' : 'bg-default/60 opacity-80',
              isTargetCovered(row.path) ? 'bg-primary/5' : '',
              isTargetMissing(row.path) ? 'bg-error/5' : '',
            ]"
          >
            <div
              class="flex min-w-0 items-start gap-3"
              :style="{ paddingLeft: `${row.depth * 14}px` }"
            >
              <span
                class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
                :class="
                  isTargetMissing(row.path)
                    ? 'bg-error/10 text-error'
                    : isTargetCovered(row.path)
                      ? 'bg-primary/10 text-primary'
                      : 'bg-elevated text-muted'
                "
              >
                <UIcon
                  :name="isTargetCovered(row.path) ? 'i-lucide-check' : 'i-lucide-dot'"
                  class="size-3"
                />
              </span>

              <div class="min-w-0 flex-1">
                <div
                  class="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex min-w-0 flex-wrap items-center gap-2">
                      <span class="font-mono text-sm break-words">{{ row.path }}</span>
                      <UBadge
                        v-if="row.field.required === true && row.mappable"
                        color="error"
                        variant="subtle"
                        class="text-[10px]"
                      >
                        {{ t({ en: "required", ru: "обязательное" }) }}
                      </UBadge>
                    </div>
                    <div class="text-muted mt-1 text-xs">
                      <span class="font-mono">{{ row.field.type }}</span>
                      <span v-if="row.label !== row.path" class="font-mono">
                        · {{ row.label }}</span
                      >
                    </div>
                  </div>
                </div>

                <div v-if="row.field.enumValues.length > 0" class="mt-2 flex flex-wrap gap-1">
                  <UBadge
                    v-for="enumValue in row.field.enumValues"
                    :key="`${row.id}-${enumValue}`"
                    color="neutral"
                    variant="subtle"
                    class="text-[10px]"
                  >
                    {{ enumValue }}
                  </UBadge>
                </div>

                <div v-if="row.mappable" class="mt-3">
                  <p
                    v-if="getInheritedMappingLabel(row.path)"
                    class="text-muted mb-2 font-mono text-xs"
                  >
                    {{ t({ en: "Covered by", ru: "Покрыто через" }) }}
                    {{ getInheritedMappingLabel(row.path) }}
                  </p>

                  <div
                    v-if="
                      isCollectionIdRow(row) &&
                      getCollectionOptions(getLiteralStringValue(row.path)).length > 0
                    "
                    class="bg-elevated/40 mb-3 rounded-xl p-3"
                  >
                    <p class="text-muted mb-2 text-xs">
                      {{ t({ en: "Fixed collection", ru: "Фиксированная коллекция" }) }}
                    </p>
                    <USelectMenu
                      :model-value="getLiteralStringValue(row.path) ?? undefined"
                      :items="getCollectionOptions(getLiteralStringValue(row.path))"
                      value-key="value"
                      label-key="label"
                      color="neutral"
                      variant="soft"
                      clear
                      class="w-full"
                      :search-input="{
                        placeholder: t({ en: 'Find collection', ru: 'Найти коллекцию' }),
                        icon: 'i-lucide-search',
                      }"
                      :placeholder="t({ en: 'Choose collection', ru: 'Выберите коллекцию' })"
                      @update:model-value="
                        updateLiteralMapping(row.path, getSelectStringValue($event))
                      "
                    />
                    <p class="text-muted mt-2 text-xs">
                      {{
                        t({
                          en: "Use this when the next input depends on a specific collection schema.",
                          ru: "Используйте это, когда следующий вход зависит от схемы конкретной коллекции.",
                        })
                      }}
                    </p>
                  </div>

                  <USelectMenu
                    :model-value="model.getMappedSourcePath(row.path) ?? undefined"
                    :items="getSourceOptionsForRow(row)"
                    value-key="value"
                    label-key="label"
                    color="neutral"
                    variant="soft"
                    clear
                    :disabled="getSourceOptionsForRow(row).length === 0"
                    :search-input="{
                      placeholder: t({ en: 'Find source field', ru: 'Найти поле источника' }),
                      icon: 'i-lucide-search',
                    }"
                    class="w-full"
                    :placeholder="t({ en: 'Choose source field', ru: 'Выберите поле источника' })"
                    @update:model-value="updateMapping(row.path, getSelectStringValue($event))"
                  />

                  <div
                    v-if="isFilterObjectRow(row)"
                    class="bg-elevated/40 mt-3 space-y-3 rounded-xl p-3"
                  >
                    <div class="bg-default/80 rounded-xl p-3">
                      <p class="text-muted mb-2 text-xs">
                        {{
                          t({ en: "Collection for this filter", ru: "Коллекция для этого фильтра" })
                        }}
                      </p>
                      <USelectMenu
                        :model-value="getSelectedCollectionIdForFilterPath(row.path) ?? undefined"
                        :items="
                          getCollectionOptions(getSelectedCollectionIdForFilterPath(row.path))
                        "
                        value-key="value"
                        label-key="label"
                        color="neutral"
                        variant="soft"
                        clear
                        class="w-full"
                        :search-input="{
                          placeholder: t({ en: 'Find collection', ru: 'Найти коллекцию' }),
                          icon: 'i-lucide-search',
                        }"
                        :placeholder="t({ en: 'Choose collection', ru: 'Выберите коллекцию' })"
                        @update:model-value="
                          updateLiteralMapping(
                            getFilterCollectionTargetPath(row.path),
                            getSelectStringValue($event),
                          )
                        "
                      />
                      <p
                        v-if="getSelectedCollectionForFilterPath(row.path)"
                        class="text-muted mt-2 text-xs"
                      >
                        {{
                          t({
                            en: "Rules below use the selected collection schema.",
                            ru: "Правила ниже используют схему выбранной коллекции.",
                          })
                        }}
                      </p>
                    </div>

                    <div
                      v-if="!getSelectedCollectionForFilterPath(row.path)"
                      class="text-muted bg-default/80 rounded-xl p-3 text-sm"
                    >
                      {{
                        t({
                          en: "Choose a fixed collection to build filter rules from real collection fields.",
                          ru: "Выберите фиксированную коллекцию, чтобы собирать правила фильтра по реальным полям коллекции.",
                        })
                      }}
                    </div>

                    <template v-else>
                      <p class="text-muted text-xs">
                        {{
                          t({
                            en: "Build filter rules by choosing a collection field, operator, and source value.",
                            ru: "Соберите правило фильтра через выбор поля коллекции, оператора и значения из источника.",
                          })
                        }}
                      </p>

                      <div
                        v-for="rule in getFilterRules(row.path)"
                        :key="rule.targetPath"
                        class="bg-default/80 rounded-xl p-3"
                      >
                        <div
                          v-if="rule.supported"
                          class="grid gap-2 lg:grid-cols-[minmax(0,220px)_minmax(0,220px)_minmax(0,1fr)_auto] lg:items-center"
                        >
                          <USelectMenu
                            :model-value="rule.fieldPath ?? undefined"
                            :items="getCollectionFieldOptionsForFilterPath(row.path)"
                            value-key="value"
                            label-key="label"
                            color="neutral"
                            variant="soft"
                            :disabled="rule.operator === '_search'"
                            :placeholder="t({ en: 'Collection field', ru: 'Поле коллекции' })"
                            @update:model-value="
                              updateExistingFilterRule(row.path, rule.targetPath, {
                                fieldPath: getSelectStringValue($event),
                                operator: rule.operator ?? '_eq',
                                sourcePath: rule.sourcePath,
                              })
                            "
                          />
                          <USelectMenu
                            :model-value="rule.operator ?? undefined"
                            :items="getFilterOperatorOptionsForField(row.path, rule.fieldPath)"
                            value-key="value"
                            label-key="label"
                            color="neutral"
                            variant="soft"
                            :placeholder="t({ en: 'Operator', ru: 'Оператор' })"
                            @update:model-value="
                              updateExistingFilterRule(row.path, rule.targetPath, {
                                fieldPath:
                                  (getSelectStringValue($event) ?? '_eq') === '_search'
                                    ? null
                                    : (rule.fieldPath ??
                                      getCollectionFieldOptionsForFilterPath(row.path)[0]?.value ??
                                      null),
                                operator: getSelectStringValue($event) ?? '_eq',
                                sourcePath: rule.sourcePath,
                              })
                            "
                          />
                          <USelectMenu
                            :model-value="rule.sourcePath || undefined"
                            :items="filterRuleSourceOptions"
                            value-key="value"
                            label-key="label"
                            color="neutral"
                            variant="soft"
                            clear
                            class="min-w-0"
                            :search-input="{
                              placeholder: t({
                                en: 'Find source field',
                                ru: 'Найти поле источника',
                              }),
                              icon: 'i-lucide-search',
                            }"
                            :placeholder="
                              t({ en: 'Choose source field', ru: 'Выберите поле источника' })
                            "
                            @update:model-value="
                              updateMapping(rule.targetPath, getSelectStringValue($event))
                            "
                          />
                          <UButton
                            color="error"
                            variant="ghost"
                            icon="i-lucide-trash-2"
                            @click="removeExactMapping(rule.targetPath)"
                          >
                            {{ t({ en: "Remove", ru: "Удалить" }) }}
                          </UButton>
                        </div>

                        <div v-else>
                          <div class="text-muted mb-2 font-mono text-xs">
                            {{ row.path }}.<span class="text-default">{{
                              getRelativeTargetPath(row.path, rule.targetPath)
                            }}</span>
                          </div>
                          <div class="flex flex-col gap-2 lg:flex-row">
                            <USelectMenu
                              :model-value="rule.sourcePath || undefined"
                              :items="filterRuleSourceOptions"
                              value-key="value"
                              label-key="label"
                              color="neutral"
                              variant="soft"
                              clear
                              class="min-w-0 flex-1"
                              :search-input="{
                                placeholder: t({
                                  en: 'Find source field',
                                  ru: 'Найти поле источника',
                                }),
                                icon: 'i-lucide-search',
                              }"
                              :placeholder="
                                t({ en: 'Choose source field', ru: 'Выберите поле источника' })
                              "
                              @update:model-value="
                                updateMapping(rule.targetPath, getSelectStringValue($event))
                              "
                            />
                            <UButton
                              color="error"
                              variant="ghost"
                              icon="i-lucide-trash-2"
                              @click="removeExactMapping(rule.targetPath)"
                            >
                              {{ t({ en: "Remove", ru: "Удалить" }) }}
                            </UButton>
                          </div>
                        </div>
                      </div>

                      <div
                        v-for="draft in getFilterRuleDraftList(row.path)"
                        :key="draft.id"
                        class="bg-default/80 rounded-xl p-3"
                      >
                        <div
                          class="grid gap-2 lg:grid-cols-[minmax(0,220px)_minmax(0,220px)_minmax(0,1fr)_auto_auto] lg:items-center"
                        >
                          <USelectMenu
                            :model-value="draft.fieldPath ?? undefined"
                            :items="getCollectionFieldOptionsForFilterPath(row.path)"
                            value-key="value"
                            label-key="label"
                            color="neutral"
                            variant="soft"
                            :disabled="draft.operator === '_search'"
                            :placeholder="t({ en: 'Collection field', ru: 'Поле коллекции' })"
                            @update:model-value="
                              updateFilterRuleDraft(row.path, draft.id, {
                                fieldPath: getSelectStringValue($event),
                              })
                            "
                          />
                          <USelectMenu
                            :model-value="draft.operator"
                            :items="getFilterOperatorOptionsForField(row.path, draft.fieldPath)"
                            value-key="value"
                            label-key="label"
                            color="neutral"
                            variant="soft"
                            :placeholder="t({ en: 'Operator', ru: 'Оператор' })"
                            @update:model-value="
                              updateFilterRuleDraft(row.path, draft.id, {
                                operator: getSelectStringValue($event) ?? '_eq',
                                fieldPath:
                                  (getSelectStringValue($event) ?? '_eq') === '_search'
                                    ? null
                                    : (draft.fieldPath ??
                                      getCollectionFieldOptionsForFilterPath(row.path)[0]?.value ??
                                      null),
                              })
                            "
                          />
                          <USelectMenu
                            :model-value="draft.sourcePath ?? undefined"
                            :items="filterRuleSourceOptions"
                            value-key="value"
                            label-key="label"
                            color="neutral"
                            variant="soft"
                            class="min-w-0"
                            :search-input="{
                              placeholder: t({
                                en: 'Find source field',
                                ru: 'Найти поле источника',
                              }),
                              icon: 'i-lucide-search',
                            }"
                            :placeholder="
                              t({ en: 'Choose source field', ru: 'Выберите поле источника' })
                            "
                            @update:model-value="
                              updateFilterRuleDraft(row.path, draft.id, {
                                sourcePath: getSelectStringValue($event),
                              })
                            "
                          />
                          <UButton
                            color="primary"
                            variant="soft"
                            :disabled="!canSaveFilterRuleDraft(row.path, draft)"
                            @click="saveFilterRuleDraft(row.path, draft.id)"
                          >
                            {{ t({ en: "Save", ru: "Сохранить" }) }}
                          </UButton>
                          <UButton
                            color="neutral"
                            variant="ghost"
                            @click="removeFilterRuleDraft(row.path, draft.id)"
                          >
                            {{ t({ en: "Cancel", ru: "Отмена" }) }}
                          </UButton>
                        </div>
                      </div>

                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-plus"
                        @click="addFilterRuleDraft(row.path)"
                      >
                        {{ t({ en: "Add filter rule", ru: "Добавить правило фильтра" }) }}
                      </UButton>
                    </template>
                  </div>

                  <div
                    v-else-if="isOpenObjectRow(row)"
                    class="bg-elevated/40 mt-3 space-y-3 rounded-xl p-3"
                  >
                    <p class="text-muted text-xs">
                      {{
                        t({
                          en: "You can map the whole object or add nested target paths such as filter.status._eq.",
                          ru: "Можно сопоставить объект целиком или добавить вложенные пути, например filter.status._eq.",
                        })
                      }}
                    </p>

                    <div
                      v-for="mapping in getCustomTargetMappings(row.path)"
                      :key="mapping.targetPath"
                      class="bg-default/80 rounded-xl p-3"
                    >
                      <div class="text-muted mb-2 font-mono text-xs">
                        {{ row.path }}.<span class="text-default">{{
                          getRelativeTargetPath(row.path, mapping.targetPath)
                        }}</span>
                      </div>
                      <div class="flex flex-col gap-2 lg:flex-row">
                        <USelectMenu
                          :model-value="mapping.sourcePath || undefined"
                          :items="customTargetSourceOptions"
                          value-key="value"
                          label-key="label"
                          color="neutral"
                          variant="soft"
                          clear
                          class="min-w-0 flex-1"
                          :search-input="{
                            placeholder: t({ en: 'Find source field', ru: 'Найти поле источника' }),
                            icon: 'i-lucide-search',
                          }"
                          :placeholder="
                            t({ en: 'Choose source field', ru: 'Выберите поле источника' })
                          "
                          @update:model-value="
                            updateMapping(mapping.targetPath, getSelectStringValue($event))
                          "
                        />
                        <UButton
                          color="error"
                          variant="ghost"
                          icon="i-lucide-trash-2"
                          @click="removeExactMapping(mapping.targetPath)"
                        >
                          {{ t({ en: "Remove", ru: "Удалить" }) }}
                        </UButton>
                      </div>
                    </div>

                    <div
                      v-for="draft in getCustomTargetDraftList(row.path)"
                      :key="draft.id"
                      class="bg-default/80 rounded-xl p-3"
                    >
                      <div
                        class="grid gap-2 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_auto_auto] lg:items-center"
                      >
                        <UInput
                          :model-value="draft.targetSuffix"
                          color="neutral"
                          variant="soft"
                          :placeholder="
                            t({
                              en: 'Nested target path, e.g. status._eq',
                              ru: 'Вложенный путь, например status._eq',
                            })
                          "
                          @update:model-value="
                            updateCustomTargetDraft(row.path, draft.id, {
                              targetSuffix: String($event),
                            })
                          "
                        />
                        <USelectMenu
                          :model-value="draft.sourcePath ?? undefined"
                          :items="customTargetSourceOptions"
                          value-key="value"
                          label-key="label"
                          color="neutral"
                          variant="soft"
                          class="min-w-0"
                          :search-input="{
                            placeholder: t({ en: 'Find source field', ru: 'Найти поле источника' }),
                            icon: 'i-lucide-search',
                          }"
                          :placeholder="
                            t({ en: 'Choose source field', ru: 'Выберите поле источника' })
                          "
                          @update:model-value="
                            updateCustomTargetDraft(row.path, draft.id, {
                              sourcePath: getSelectStringValue($event),
                            })
                          "
                        />
                        <UButton
                          color="primary"
                          variant="soft"
                          :disabled="
                            normalizeTargetSuffix(draft.targetSuffix) === '' ||
                            draft.sourcePath === null
                          "
                          @click="saveCustomTargetDraft(row.path, draft.id)"
                        >
                          {{ t({ en: "Save", ru: "Сохранить" }) }}
                        </UButton>
                        <UButton
                          color="neutral"
                          variant="ghost"
                          @click="removeCustomTargetDraft(row.path, draft.id)"
                        >
                          {{ t({ en: "Cancel", ru: "Отмена" }) }}
                        </UButton>
                      </div>
                    </div>

                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-plus"
                      @click="addCustomTargetDraft(row.path)"
                    >
                      {{ t({ en: "Add nested path", ru: "Добавить вложенный путь" }) }}
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
