<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { useRoute } from "vue-router"
import { useT } from "@exodus/edem-vue"
import {
  dataManifestSchema,
  fieldTypes,
  type FieldType,
  type ManifestField,
} from "@/project-manifest-schemas"
import { useCollectionQuery, useCreateItem, useDeleteItem, useUpdateItem } from "@/hooks"
import { PROJECT_DATA_SOURCE_COLLECTION } from "@/project-manifest-collections"
import {
  buildProjectDataManifest,
  normalizeProjectDataFields,
  type ProjectDataCollectionSourceItem,
} from "@/project-data-source"

const t = useT()
const route = useRoute()
const projectId = computed(() => route.params.id as string)

const { data: collections, loading } = useCollectionQuery(PROJECT_DATA_SOURCE_COLLECTION, () => ({
  filter: { project_id: { _eq: projectId.value } },
  sort: ["name"],
}))

const [createItem] = useCreateItem()
const [updateItem] = useUpdateItem()
const [deleteItem] = useDeleteItem()

const collectionItems = computed(
  () => collections.value as unknown as ProjectDataCollectionSourceItem[],
)

const selectedCollectionId = ref<string | null>(null)
const selectedFieldIndex = ref<number | null>(null)
const pendingDeleteFieldIndex = ref<number | null>(null)
const activeTab = ref<"fields" | "relations" | "manifest" | "settings">("fields")
const collectionSearch = ref("")
const errorMessage = ref<string | null>(null)
const deleteCollectionModalOpen = ref(false)
const deleteFieldModalOpen = ref(false)
const pendingMutations = ref(0)
const showSkeleton = ref(false)

let skeletonTimeout: ReturnType<typeof setTimeout> | null = null

const isSaving = computed(() => pendingMutations.value > 0)

const fieldTypeItems = fieldTypes.map((type) => ({
  label: type,
  value: type,
}))

const booleanDefaultItems = computed(() => [
  {
    label: t({ en: "No default", ru: "Без значения" }),
    value: "",
  },
  { label: "true", value: "true" },
  { label: "false", value: "false" },
])

const relationCollectionItems = computed(() =>
  collectionItems.value.map((item) => ({
    label: `${getCollectionName(item)} · ${getCollectionManifestId(item)}`,
    value: getCollectionManifestId(item),
  })),
)

const selectedCollection = computed(
  () => collectionItems.value.find((item) => item.id === selectedCollectionId.value) ?? null,
)

const selectedCollectionIndex = computed(() =>
  collectionItems.value.findIndex((item) => item.id === selectedCollectionId.value),
)

const selectedFields = computed(() =>
  normalizeProjectDataFields(selectedCollection.value?.data.fields),
)

const selectedField = computed(() => {
  if (selectedFieldIndex.value === null) {
    return null
  }

  return selectedFields.value[selectedFieldIndex.value] ?? null
})

const regularFieldEntries = computed(() =>
  selectedFields.value.flatMap((field, index) =>
    isRelationFieldType(field.type) ? [] : [{ field, index }],
  ),
)

const relationFieldEntries = computed(() =>
  selectedFields.value.flatMap((field, index) =>
    isRelationFieldType(field.type) ? [{ field, index }] : [],
  ),
)

const selectedRegularField = computed(() =>
  selectedField.value && !isRelationFieldType(selectedField.value.type)
    ? selectedField.value
    : null,
)

const selectedRelationField = computed(() =>
  selectedField.value && isRelationFieldType(selectedField.value.type) ? selectedField.value : null,
)

const pendingDeleteField = computed(() => {
  if (pendingDeleteFieldIndex.value === null) {
    return null
  }

  return selectedFields.value[pendingDeleteFieldIndex.value] ?? null
})

const filteredCollections = computed(() => {
  const query = collectionSearch.value.trim().toLowerCase()
  if (query === "") {
    return collectionItems.value
  }

  const filtered = collectionItems.value.filter((item) => {
    const name = getCollectionName(item).toLowerCase()
    const manifestId = getCollectionManifestId(item).toLowerCase()
    return name.includes(query) || manifestId.includes(query)
  })

  if (
    selectedCollection.value &&
    !filtered.some((item) => item.id === selectedCollection.value?.id)
  ) {
    return [selectedCollection.value, ...filtered]
  }

  return filtered
})

const builtManifest = computed(() => buildProjectDataManifest(collectionItems.value))

const manifestPreview = computed(() => JSON.stringify(builtManifest.value, null, 2))

const manifestValidation = computed(() => dataManifestSchema.safeParse(builtManifest.value))

const manifestValidationErrors = computed(() => {
  if (manifestValidation.value.success) {
    return []
  }

  return manifestValidation.value.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : ""
    return `${path}${issue.message}`
  })
})

const duplicateCollectionManifestIds = computed(() => {
  const counts = new Map<string, number>()

  for (const item of collectionItems.value) {
    const manifestId = getCollectionManifestId(item).trim()
    if (manifestId === "") {
      continue
    }

    counts.set(manifestId, (counts.get(manifestId) ?? 0) + 1)
  }

  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value))
})

const duplicateFieldNames = computed(() => {
  const counts = new Map<string, number>()

  for (const field of selectedFields.value) {
    const name = field.name.trim()
    if (name === "") {
      continue
    }

    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value))
})

const collectionIssueCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {}

  if (!manifestValidation.value.success) {
    for (const issue of manifestValidation.value.error.issues) {
      const collectionIndex = getIssueCollectionIndex(issue.path)
      if (collectionIndex === null) {
        continue
      }

      const collection = collectionItems.value[collectionIndex]
      if (!collection) {
        continue
      }

      counts[collection.id] = (counts[collection.id] ?? 0) + 1
    }
  }

  for (const collection of collectionItems.value) {
    if (duplicateCollectionManifestIds.value.has(getCollectionManifestId(collection).trim())) {
      counts[collection.id] = (counts[collection.id] ?? 0) + 1
    }
  }

  return counts
})

const selectedCollectionIssues = computed(() => {
  if (!selectedCollection.value) {
    return []
  }

  const issues: string[] = []

  if (
    duplicateCollectionManifestIds.value.has(
      getCollectionManifestId(selectedCollection.value).trim(),
    )
  ) {
    issues.push(
      t({
        en: "Manifest ID must be unique across collections.",
        ru: "Manifest ID должен быть уникальным среди коллекций.",
      }),
    )
  }

  if (!manifestValidation.value.success) {
    for (const issue of manifestValidation.value.error.issues) {
      if (getIssueCollectionIndex(issue.path) !== selectedCollectionIndex.value) {
        continue
      }

      if (issue.path[2] === "fields") {
        continue
      }

      const fieldPath = issue.path.length > 2 ? `${issue.path.slice(2).join(".")}: ` : ""
      issues.push(`${fieldPath}${issue.message}`)
    }
  }

  return Array.from(new Set(issues))
})

const fieldIssuesByIndex = computed<Record<number, string[]>>(() => {
  const issues: Record<number, string[]> = {}

  if (!manifestValidation.value.success) {
    for (const issue of manifestValidation.value.error.issues) {
      if (getIssueCollectionIndex(issue.path) !== selectedCollectionIndex.value) {
        continue
      }

      if (issue.path[2] !== "fields" || typeof issue.path[3] !== "number") {
        continue
      }

      const fieldIndex = issue.path[3]
      const fieldPath = issue.path.length > 4 ? `${issue.path.slice(4).join(".")}: ` : ""
      addFieldIssue(issues, fieldIndex, `${fieldPath}${issue.message}`)
    }
  }

  selectedFields.value.forEach((field, index) => {
    if (duplicateFieldNames.value.has(field.name.trim())) {
      addFieldIssue(
        issues,
        index,
        t({
          en: "Field name must be unique inside the collection.",
          ru: "Имя поля должно быть уникальным внутри коллекции.",
        }),
      )
    }
  })

  return issues
})

const regularFieldIssueCount = computed(() =>
  regularFieldEntries.value.reduce((total, entry) => total + getFieldIssueCount(entry.index), 0),
)

const relationFieldIssueCount = computed(() =>
  relationFieldEntries.value.reduce((total, entry) => total + getFieldIssueCount(entry.index), 0),
)

const relationTargetSuggestions = computed(() => {
  const currentManifestId = selectedCollection.value
    ? getCollectionManifestId(selectedCollection.value)
    : null
  const otherCollections = relationCollectionItems.value.filter(
    (item) => item.value !== currentManifestId,
  )
  return otherCollections.length > 0 ? otherCollections : relationCollectionItems.value
})

const hasAnyIssues = computed(() => {
  if (manifestValidationErrors.value.length > 0) {
    return true
  }

  return Object.values(collectionIssueCounts.value).some((count) => count > 0)
})

const deleteCollectionDescription = computed(() =>
  t({
    en: "This will remove the collection from the project. This action cannot be undone.",
    ru: "Это удалит коллекцию из проекта. Это действие нельзя отменить.",
  }),
)

const deleteFieldDescription = computed(() => {
  if (pendingDeleteField.value) {
    return t({
      en: `Field "${pendingDeleteField.value.name}" will be removed from the collection. This action cannot be undone.`,
      ru: `Поле "${pendingDeleteField.value.name}" будет удалено из коллекции. Это действие нельзя отменить.`,
    })
  }

  return t({
    en: "This field will be removed from the collection. This action cannot be undone.",
    ru: "Поле будет удалено из коллекции. Это действие нельзя отменить.",
  })
})

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
  collectionItems,
  (items) => {
    if (items.length === 0) {
      selectedCollectionId.value = null
      return
    }

    if (
      !selectedCollectionId.value ||
      !items.some((item) => item.id === selectedCollectionId.value)
    ) {
      selectedCollectionId.value = items[0]?.id ?? null
    }
  },
  { immediate: true },
)

watch(selectedCollectionId, () => {
  selectedFieldIndex.value = null
  activeTab.value = "fields"
})

watch(
  [selectedFields, activeTab],
  ([fields, tab]) => {
    if (fields.length === 0) {
      selectedFieldIndex.value = null
      return
    }

    if (tab === "settings" || tab === "manifest") {
      if (selectedFieldIndex.value !== null && selectedFieldIndex.value >= fields.length) {
        selectedFieldIndex.value = null
      }
      return
    }

    const currentField = selectedFieldIndex.value === null ? null : fields[selectedFieldIndex.value]
    const currentVisible =
      currentField &&
      ((tab === "fields" && !isRelationFieldType(currentField.type)) ||
        (tab === "relations" && isRelationFieldType(currentField.type)))

    if (
      currentVisible &&
      selectedFieldIndex.value !== null &&
      selectedFieldIndex.value < fields.length
    ) {
      return
    }

    selectedFieldIndex.value = getFirstFieldIndexForTab(tab)
  },
  { immediate: true },
)

function getFirstFieldIndexForTab(
  tab: "fields" | "relations" | "manifest" | "settings",
): number | null {
  if (tab === "fields") {
    const entry = regularFieldEntries.value[0]
    return entry ? entry.index : null
  }

  if (tab === "relations") {
    const entry = relationFieldEntries.value[0]
    return entry ? entry.index : null
  }

  if (selectedFields.value.length === 0) {
    return null
  }

  return selectedFieldIndex.value !== null && selectedFieldIndex.value < selectedFields.value.length
    ? selectedFieldIndex.value
    : 0
}

function getCollectionNameByManifestId(manifestId: string): string {
  const match = collectionItems.value.find((item) => getCollectionManifestId(item) === manifestId)
  return match ? getCollectionName(match) : manifestId
}

function getRelationTargetCollectionName(field: ManifestField): string {
  const manifestId = getRelationCollectionValue(field)

  if (manifestId === "") {
    return t({ en: "Target is not selected", ru: "Целевая коллекция не выбрана" })
  }

  return getCollectionNameByManifestId(manifestId)
}

function getRelationFieldSummary(field: ManifestField): string {
  const sourceName = selectedCollection.value
    ? getCollectionName(selectedCollection.value)
    : t({ en: "Current collection", ru: "Текущая коллекция" })

  return `${sourceName} -> ${field.name} -> ${getRelationTargetCollectionName(field)}`
}

function getRelationBadgeColor(_field: ManifestField): "primary" {
  return "primary"
}

function getRelationFieldName(fields: ManifestField[]): string {
  const existing = new Set(fields.map((field) => field.name))
  let index = 1
  let candidate = `relation_${index}`

  while (existing.has(candidate)) {
    index += 1
    candidate = `relation_${index}`
  }

  return candidate
}

function getDefaultRelationTargetCollectionId(): string | undefined {
  const currentManifestId = selectedCollection.value
    ? getCollectionManifestId(selectedCollection.value)
    : undefined
  const otherCollection = relationCollectionItems.value.find(
    (item) => item.value !== currentManifestId,
  )

  return otherCollection?.value ?? currentManifestId ?? relationCollectionItems.value[0]?.value
}

function openRelationsTab() {
  activeTab.value = "relations"
}

function openFieldsTab() {
  activeTab.value = "fields"
}

function openSettingsTab() {
  activeTab.value = "settings"
}

function openManifestTab() {
  activeTab.value = "manifest"
}

function selectRelationField(index: number) {
  selectedFieldIndex.value = index
  activeTab.value = "relations"
}

function selectRegularField(index: number) {
  selectedFieldIndex.value = index
  activeTab.value = "fields"
}

async function handleCreateRelationField(targetCollectionId?: string) {
  const nextIndex = selectedFields.value.length
  const nextTargetCollectionId = targetCollectionId ?? getDefaultRelationTargetCollectionId() ?? ""

  await updateSelectedFields((fields) => [
    ...fields,
    {
      name: getRelationFieldName(fields),
      type: "relation",
      relation: {
        collection: nextTargetCollectionId,
      },
    },
  ])

  selectedFieldIndex.value = nextIndex
  activeTab.value = "relations"
}

function getRelationEmptyStateDescription(): string {
  if (relationCollectionItems.value.length <= 1) {
    return t({
      en: "Create the first relation. You can link it to this collection now and change it later.",
      ru: "Создай первую связь. Пока можно связать её с этой же коллекцией, а потом поменять цель.",
    })
  }

  return t({
    en: "Create the first relation by choosing which collection it should link to.",
    ru: "Создай первую связь, выбрав, к какой коллекции она должна вести.",
  })
}

function addFieldIssue(map: Record<number, string[]>, index: number, message: string) {
  map[index] ??= []
  map[index].push(message)
}

function getIssueCollectionIndex(path: PropertyKey[]): number | null {
  if (path[0] !== "collections" || typeof path[1] !== "number") {
    return null
  }

  return path[1]
}

function getTextEventValue(event: FocusEvent | KeyboardEvent): string {
  const target = event.target

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return target.value
  }

  return ""
}

function getCollectionName(item: ProjectDataCollectionSourceItem): string {
  if (typeof item.data.name === "string" && item.data.name.trim() !== "") {
    return item.data.name
  }

  return t({ en: "Untitled collection", ru: "Коллекция без названия" })
}

function getCollectionManifestId(item: ProjectDataCollectionSourceItem): string {
  if (typeof item.data.manifest_id === "string" && item.data.manifest_id.trim() !== "") {
    return item.data.manifest_id
  }

  return item.id
}

function getCollectionIssueCount(item: ProjectDataCollectionSourceItem): number {
  return collectionIssueCounts.value[item.id] ?? 0
}

function getFieldIssueCount(index: number): number {
  return fieldIssuesByIndex.value[index]?.length ?? 0
}

function getFieldDefaultPreview(value: unknown): string {
  if (value === undefined) {
    return t({ en: "No default", ru: "Без значения" })
  }

  if (typeof value === "string") {
    return value === "" ? '""' : value
  }

  return JSON.stringify(value)
}

function getIssueCountLabel(count: number): string {
  return t({
    en: `${count} issue${count === 1 ? "" : "s"}`,
    ru: `${count} ошибок`,
  })
}

function getSelectStringValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value
  }

  if (Array.isArray(value)) {
    return getSelectStringValue(value[0])
  }

  if (typeof value === "object" && value !== null && "value" in value) {
    const nextValue = (value as { value?: unknown }).value
    return typeof nextValue === "string" ? nextValue : null
  }

  return null
}

function serializeDefaultValue(value: unknown): string {
  if (value === undefined) {
    return ""
  }

  if (typeof value === "string") {
    return value
  }

  return JSON.stringify(value)
}

function getBooleanDefaultValue(value: unknown): string {
  if (value === true) return "true"
  if (value === false) return "false"
  return ""
}

function isBooleanFieldType(type: FieldType): boolean {
  return type === "boolean"
}

function isRelationFieldType(type: FieldType): boolean {
  return type === "relation"
}

function isNumericFieldType(type: FieldType): boolean {
  return type === "number" || type === "sort"
}

function isMultilineFieldType(type: FieldType): boolean {
  return type === "text" || type === "json"
}

function getFieldDefaultPlaceholder(type: FieldType): string {
  switch (type) {
    case "number":
    case "sort":
      return t({ en: "42", ru: "42" })
    case "boolean":
      return t({ en: "Choose true or false", ru: "Выбери true или false" })
    case "json":
      return '{ "key": "value" }'
    case "date":
      return "2026-05-24"
    case "datetime":
    case "timestamp":
      return "2026-05-24T18:00:00Z"
    case "relation":
      return t({ en: "Default linked record ID", ru: "ID связанной записи по умолчанию" })
    default:
      return t({ en: "Optional default value", ru: "Необязательное значение по умолчанию" })
  }
}

function getFieldTypeHint(type: FieldType): string {
  switch (type) {
    case "string":
      return t({ en: "Short single-line text.", ru: "Короткий однострочный текст." })
    case "text":
      return t({ en: "Long-form multiline content.", ru: "Многострочный текст." })
    case "number":
      return t({ en: "Numeric value.", ru: "Числовое значение." })
    case "boolean":
      return t({ en: "True or false flag.", ru: "Логический флаг true или false." })
    case "date":
      return t({ en: "Date in ISO format YYYY-MM-DD.", ru: "Дата в ISO-формате ГГГГ-ММ-ДД." })
    case "datetime":
      return t({ en: "Date and time in ISO format.", ru: "Дата и время в ISO-формате." })
    case "json":
      return t({
        en: "Structured object or array value.",
        ru: "Структурированный объект или массив.",
      })
    case "relation":
      return t({ en: "Link to another collection.", ru: "Связь с другой коллекцией." })
    case "collection":
      return t({ en: "Nested structure.", ru: "Вложенная структура." })
    case "uuid":
      return t({ en: "Unique identifier.", ru: "Уникальный идентификатор." })
    case "timestamp":
      return t({ en: "Timestamp in ISO format.", ru: "Timestamp в ISO-формате." })
    case "file":
      return t({ en: "File.", ru: "Файл." })
    case "image":
      return t({ en: "Image.", ru: "Изображение." })
    case "video":
      return t({ en: "Video.", ru: "Видео." })
    case "user":
      return t({ en: "User identifier.", ru: "Идентификатор пользователя." })
    case "sort":
      return t({ en: "Sort order.", ru: "Порядок сортировки." })
    default:
      return t({ en: "Field in this collection.", ru: "Поле в этой коллекции." })
  }
}

function getRelationCollectionValue(field: ManifestField): string {
  if (field.relation?.collection) {
    return field.relation.collection
  }

  if (typeof field.options?.collection === "string") {
    return field.options.collection
  }

  if (typeof field.options?.target_collection_id === "string") {
    return field.options.target_collection_id
  }

  return ""
}

function getRelationCollectionItems(currentValue: string): { label: string; value: string }[] {
  if (
    currentValue === "" ||
    relationCollectionItems.value.some((item) => item.value === currentValue)
  ) {
    return relationCollectionItems.value
  }

  return [{ label: currentValue, value: currentValue }, ...relationCollectionItems.value]
}

function parseDefaultValue(type: FieldType, rawValue: string): unknown {
  const trimmed = rawValue.trim()

  if (trimmed === "") {
    return undefined
  }

  if (type === "number" || type === "sort") {
    const parsed = Number(trimmed)
    if (Number.isNaN(parsed)) {
      throw new Error(`Default value for ${type} must be a number`)
    }
    return parsed
  }

  if (type === "boolean") {
    if (trimmed === "true") return true
    if (trimmed === "false") return false
    throw new Error("Default value for boolean must be true or false")
  }

  if (type === "json") {
    return JSON.parse(trimmed)
  }

  return trimmed
}

async function runMutation<T>(operation: () => Promise<T>): Promise<T> {
  pendingMutations.value += 1

  try {
    return await operation()
  } finally {
    pendingMutations.value -= 1
  }
}

async function saveSelectedCollectionPatch(patch: Record<string, unknown>) {
  if (!selectedCollection.value) {
    return
  }

  errorMessage.value = null

  try {
    await runMutation(() => updateItem(selectedCollection.value!.id, patch))
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

async function updateSelectedFields(mutator: (fields: ManifestField[]) => ManifestField[]) {
  const currentCollection = selectedCollection.value
  if (!currentCollection) {
    return
  }

  await saveSelectedCollectionPatch({
    fields: mutator(normalizeProjectDataFields(currentCollection.data.fields)),
  })
}

function buildCollectionManifestId(): string {
  const existingIds = new Set(
    collectionItems.value
      .map((item) => item.data.manifest_id)
      .filter((value): value is string => typeof value === "string" && value.trim() !== ""),
  )

  let index = collectionItems.value.length + 1
  let candidate = `collection_${index}`

  while (existingIds.has(candidate)) {
    index += 1
    candidate = `collection_${index}`
  }

  return candidate
}

function buildFieldName(fields: ManifestField[]): string {
  const existing = new Set(fields.map((field) => field.name))
  let index = fields.length + 1
  let candidate = `field_${index}`

  while (existing.has(candidate)) {
    index += 1
    candidate = `field_${index}`
  }

  return candidate
}

async function handleCreateCollection() {
  errorMessage.value = null

  try {
    const id = await runMutation(() =>
      createItem(PROJECT_DATA_SOURCE_COLLECTION, {
        project_id: projectId.value,
        manifest_id: buildCollectionManifestId(),
        name: t({ en: "New collection", ru: "Новая коллекция" }),
        singleton: false,
        fields: [],
      }),
    )

    collectionSearch.value = ""
    selectedCollectionId.value = id
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

function openDeleteCollectionModal() {
  deleteCollectionModalOpen.value = true
}

function closeDeleteCollectionModal() {
  deleteCollectionModalOpen.value = false
}

async function confirmDeleteCollection() {
  if (!selectedCollection.value) {
    return
  }

  errorMessage.value = null

  try {
    await runMutation(() => deleteItem(selectedCollection.value!.id))
    deleteCollectionModalOpen.value = false
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

async function handleAddField() {
  const nextIndex = selectedFields.value.length

  await updateSelectedFields((fields) => [
    ...fields,
    {
      name: buildFieldName(fields),
      type: "string",
    },
  ])

  selectedFieldIndex.value = nextIndex
}

function openDeleteFieldModal(index: number) {
  pendingDeleteFieldIndex.value = index
  deleteFieldModalOpen.value = true
}

function closeDeleteFieldModal() {
  deleteFieldModalOpen.value = false
  pendingDeleteFieldIndex.value = null
}

async function confirmDeleteField() {
  if (pendingDeleteFieldIndex.value === null) {
    return
  }

  const deletedIndex = pendingDeleteFieldIndex.value

  await updateSelectedFields((fields) =>
    fields.filter((_, fieldIndex) => fieldIndex !== deletedIndex),
  )

  if (selectedFieldIndex.value !== null) {
    if (selectedFieldIndex.value === deletedIndex) {
      selectedFieldIndex.value = deletedIndex > 0 ? deletedIndex - 1 : 0
    } else if (selectedFieldIndex.value > deletedIndex) {
      selectedFieldIndex.value -= 1
    }
  }

  closeDeleteFieldModal()
}

function selectCollection(id: string) {
  selectedCollectionId.value = id
}

async function handleUpdateCollectionName(event: FocusEvent | KeyboardEvent) {
  const value = getTextEventValue(event).trim()
  if (!selectedCollection.value || value === "" || value === selectedCollection.value.data.name) {
    return
  }

  await saveSelectedCollectionPatch({ name: value })
}

async function handleUpdateCollectionManifestId(event: FocusEvent | KeyboardEvent) {
  const value = getTextEventValue(event).trim()
  if (
    !selectedCollection.value ||
    value === "" ||
    value === selectedCollection.value.data.manifest_id
  ) {
    return
  }

  await saveSelectedCollectionPatch({ manifest_id: value })
}

async function handleUpdateCollectionDescription(event: FocusEvent) {
  const value = getTextEventValue(event).trim()
  if (!selectedCollection.value) {
    return
  }

  await saveSelectedCollectionPatch({ description: value || undefined })
}

async function handleUpdateSingleton(value: boolean) {
  await saveSelectedCollectionPatch({ singleton: value })
}

async function handleUpdateFieldName(index: number, event: FocusEvent | KeyboardEvent) {
  const value = getTextEventValue(event).trim()
  if (value === "") {
    return
  }

  await updateSelectedFields((fields) =>
    fields.map((field, fieldIndex) =>
      fieldIndex === index
        ? {
            ...field,
            name: value,
          }
        : field,
    ),
  )
}

async function handleUpdateFieldType(index: number, value: unknown) {
  const nextType = getSelectStringValue(value) as FieldType | null
  if (!nextType) {
    return
  }

  await updateSelectedFields((fields) =>
    fields.map((field, fieldIndex) =>
      fieldIndex === index
        ? (() => {
            const nextField: ManifestField = {
              ...field,
              type: nextType,
            }

            if (nextType === "relation") {
              nextField.relation ??= { collection: getDefaultRelationTargetCollectionId() ?? "" }
            } else {
              delete nextField.relation
            }

            return nextField
          })()
        : field,
    ),
  )
}

async function handleUpdateFieldRelationCollection(index: number, value: unknown) {
  const nextCollectionId = getSelectStringValue(value)?.trim()
  if (!nextCollectionId) {
    return
  }

  await updateSelectedFields((fields) =>
    fields.map((field, fieldIndex) =>
      fieldIndex === index
        ? {
            ...field,
            relation: { collection: nextCollectionId },
          }
        : field,
    ),
  )
}

async function handleUpdateFieldRequired(index: number, value: boolean) {
  await updateSelectedFields((fields) =>
    fields.map((field, fieldIndex) =>
      fieldIndex === index
        ? {
            ...field,
            required: value || undefined,
          }
        : field,
    ),
  )
}

async function handleUpdateFieldDefault(index: number, type: FieldType, event: FocusEvent) {
  await handleUpdateFieldDefaultValue(index, type, getTextEventValue(event))
}

async function handleUpdateFieldBooleanDefault(index: number, value: unknown) {
  await handleUpdateFieldDefaultValue(index, "boolean", getSelectStringValue(value) ?? "")
}

async function handleUpdateFieldDefaultValue(index: number, type: FieldType, rawValue: string) {
  try {
    const nextDefault = parseDefaultValue(type, rawValue)
    await updateSelectedFields((fields) =>
      fields.map((field, fieldIndex) => {
        if (fieldIndex !== index) {
          return field
        }

        if (nextDefault === undefined) {
          const nextField = { ...field }
          delete nextField.default
          return nextField
        }

        return {
          ...field,
          default: nextDefault,
        }
      }),
    )
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}
</script>

<template>
  <div class="bg-elevated/10 flex h-full min-h-0">
    <aside class="border-default bg-default/80 flex w-80 shrink-0 flex-col border-r backdrop-blur">
      <div class="border-default border-b px-4 py-4">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 class="text-base font-semibold">{{ t({ en: "Data", ru: "Данные" }) }}</h1>
            <p class="text-muted mt-1 text-xs">
              {{
                t({
                  en: "Set up collections, fields and links for your app.",
                  ru: "Настрой коллекции, поля и связи для своего приложения.",
                })
              }}
            </p>
          </div>

          <UButton size="xs" icon="i-lucide-plus" @click="handleCreateCollection" />
        </div>

        <UInput
          v-model="collectionSearch"
          :placeholder="t({ en: 'Search collections', ru: 'Поиск коллекций' })"
          class="w-full"
        />

        <div class="text-muted mt-3 flex items-center justify-between text-xs">
          <span>{{ t({ en: "Collections", ru: "Коллекции" }) }}</span>
          <span>{{ collectionItems.length }}</span>
        </div>
      </div>

      <div v-if="loading && showSkeleton" class="flex flex-1 flex-col gap-3 p-3">
        <div v-for="i in 5" :key="i" class="border-default rounded-2xl border p-3">
          <USkeleton class="mb-2 h-4 w-32" />
          <USkeleton class="h-3 w-24" />
        </div>
      </div>

      <div
        v-else-if="!loading && collectionItems.length === 0"
        class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <UIcon name="i-lucide-database-zap" class="text-muted h-10 w-10" />
        <p class="text-muted text-sm">
          {{ t({ en: "No project collections yet", ru: "Пока нет проектных коллекций" }) }}
        </p>
        <UButton size="sm" @click="handleCreateCollection">
          {{ t({ en: "Create collection", ru: "Создать коллекцию" }) }}
        </UButton>
      </div>

      <div
        v-else-if="filteredCollections.length === 0"
        class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <UIcon name="i-lucide-search-x" class="text-muted h-10 w-10" />
        <p class="text-muted text-sm">
          {{
            t({ en: "No collections match this search", ru: "По этому поиску ничего не найдено" })
          }}
        </p>
      </div>

      <div v-else class="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
        <button
          v-for="collection in filteredCollections"
          :key="collection.id"
          class="border-default mb-2 flex w-full flex-col gap-2 rounded-2xl border px-3 py-2.5 text-left transition-colors"
          :class="
            selectedCollectionId === collection.id
              ? 'bg-elevated shadow-sm'
              : 'bg-default hover:bg-elevated/70'
          "
          @click="selectCollection(collection.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ getCollectionName(collection) }}</p>
              <p class="text-muted truncate font-mono text-xs">
                {{ getCollectionManifestId(collection) }}
              </p>
            </div>

            <div class="flex shrink-0 flex-col items-end gap-1">
              <UBadge
                v-if="collection.data.singleton === true"
                :label="t({ en: 'One record', ru: 'Одна запись' })"
                color="primary"
                variant="subtle"
                size="sm"
              />
              <UBadge
                v-if="getCollectionIssueCount(collection) > 0"
                :label="getIssueCountLabel(getCollectionIssueCount(collection))"
                color="error"
                variant="subtle"
                size="sm"
              />
            </div>
          </div>
        </button>
      </div>
    </aside>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        class="border-default bg-default/80 flex items-center justify-between border-b px-6 py-4 backdrop-blur"
      >
        <div>
          <h2 class="text-lg font-semibold">
            {{
              selectedCollection
                ? getCollectionName(selectedCollection)
                : t({ en: "Data editor", ru: "Редактор данных" })
            }}
          </h2>
          <p class="text-muted mt-1 text-sm">
            {{
              t({
                en: "Build the structure of your data: collections, fields and links.",
                ru: "Собери структуру данных: коллекции, поля и связи.",
              })
            }}
          </p>
        </div>

        <div class="flex items-center gap-2">
          <UBadge
            :label="
              isSaving
                ? t({ en: 'Saving...', ru: 'Сохранение...' })
                : t({ en: 'Auto-save', ru: 'Автосохранение' })
            "
            :color="isSaving ? 'warning' : 'success'"
            variant="subtle"
            size="sm"
          />
          <UBadge
            v-if="selectedCollection && getCollectionIssueCount(selectedCollection) > 0"
            :label="getIssueCountLabel(getCollectionIssueCount(selectedCollection))"
            color="error"
            variant="subtle"
            size="sm"
          />
        </div>
      </div>

      <div
        v-if="errorMessage"
        class="border-default bg-error/5 text-error border-b px-6 py-3 text-sm"
      >
        {{ errorMessage }}
      </div>

      <div
        v-if="hasAnyIssues"
        class="border-default bg-error/5 text-error border-b px-6 py-3 text-sm"
      >
        <div class="flex items-start gap-2">
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {{
              t({
                en: "There are issues in this setup. Check the error badges in collections, fields, relations, or collection settings.",
                ru: "В этой настройке есть ошибки. Посмотри бейджи в коллекциях, полях, связях или настройках коллекции.",
              })
            }}
          </p>
        </div>
      </div>

      <div
        v-if="selectedCollection"
        class="border-default bg-default/70 border-b px-6 py-3 backdrop-blur"
      >
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
            :class="
              activeTab === 'fields'
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:bg-elevated hover:text-default'
            "
            @click="openFieldsTab"
          >
            <UIcon name="i-lucide-columns-2" class="h-4 w-4" />
            <span>{{ t({ en: "Fields", ru: "Поля" }) }}</span>
            <UBadge
              :label="`${regularFieldEntries.length}`"
              color="primary"
              variant="soft"
              size="sm"
            />
            <UBadge
              v-if="regularFieldIssueCount > 0"
              :label="getIssueCountLabel(regularFieldIssueCount)"
              color="error"
              variant="subtle"
              size="sm"
            />
          </button>

          <button
            class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
            :class="
              activeTab === 'relations'
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:bg-elevated hover:text-default'
            "
            @click="openRelationsTab"
          >
            <UIcon name="i-lucide-waypoints" class="h-4 w-4" />
            <span>{{ t({ en: "Relations", ru: "Связи" }) }}</span>
            <UBadge
              :label="`${relationFieldEntries.length}`"
              color="primary"
              variant="soft"
              size="sm"
            />
            <UBadge
              v-if="relationFieldIssueCount > 0"
              :label="getIssueCountLabel(relationFieldIssueCount)"
              color="error"
              variant="subtle"
              size="sm"
            />
          </button>

          <button
            class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
            :class="
              activeTab === 'manifest'
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:bg-elevated hover:text-default'
            "
            @click="openManifestTab"
          >
            <UIcon name="i-lucide-braces" class="h-4 w-4" />
            <span>{{ t({ en: "Manifest", ru: "Манифест" }) }}</span>
            <UBadge
              v-if="manifestValidationErrors.length > 0"
              :label="getIssueCountLabel(manifestValidationErrors.length)"
              color="error"
              variant="subtle"
              size="sm"
            />
          </button>

          <button
            class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
            :class="
              activeTab === 'settings'
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:bg-elevated hover:text-default'
            "
            @click="openSettingsTab"
          >
            <UIcon name="i-lucide-settings-2" class="h-4 w-4" />
            <span>{{ t({ en: "Collection", ru: "Коллекция" }) }}</span>
            <UBadge
              v-if="selectedCollectionIssues.length > 0"
              :label="getIssueCountLabel(selectedCollectionIssues.length)"
              color="error"
              variant="subtle"
              size="sm"
            />
          </button>
        </div>
      </div>

      <div v-if="loading && showSkeleton" class="flex flex-1 flex-col gap-6 overflow-hidden p-6">
        <div class="grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
          <USkeleton class="h-[420px] w-full rounded-3xl" />
          <USkeleton class="h-[420px] w-full rounded-3xl" />
        </div>
      </div>

      <div
        v-else-if="!selectedCollection"
        class="text-muted flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <UIcon name="i-lucide-square-pen" class="h-10 w-10" />
        <p>
          {{
            t({ en: "Select a collection to continue", ru: "Выбери коллекцию, чтобы продолжить" })
          }}
        </p>
      </div>

      <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        <div class="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-6">
          <section
            v-if="activeTab === 'fields'"
            class="grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(0,1fr)_440px]"
          >
            <div
              class="border-default bg-default flex min-h-0 flex-col overflow-hidden rounded-3xl border shadow-sm"
            >
              <div class="border-default flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h3 class="text-base font-semibold">{{ t({ en: "Fields", ru: "Поля" }) }}</h3>
                  <p class="text-muted mt-1 text-sm">
                    {{
                      t({
                        en: "Select a field to edit it on the right.",
                        ru: "Выбери поле, чтобы редактировать его справа.",
                      })
                    }}
                  </p>
                </div>

                <UButton size="sm" icon="i-lucide-plus" @click="handleAddField">
                  {{ t({ en: "Add field", ru: "Добавить поле" }) }}
                </UButton>
              </div>

              <div
                v-if="regularFieldEntries.length === 0"
                class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center"
              >
                <UIcon name="i-lucide-columns-2" class="text-muted h-10 w-10" />
                <p class="text-muted text-sm">
                  {{
                    t({
                      en: "No fields yet. Add your first field here. Links are edited in the Relations tab.",
                      ru: "Пока нет полей. Добавь первое поле здесь. Связи редактируются во вкладке Связи.",
                    })
                  }}
                </p>
              </div>

              <div v-else class="min-h-0 flex-1 overflow-auto">
                <table class="min-w-full text-sm">
                  <thead class="bg-elevated/60 text-muted">
                    <tr>
                      <th class="px-5 py-3 text-left font-medium">
                        {{ t({ en: "Field", ru: "Поле" }) }}
                      </th>
                      <th class="px-5 py-3 text-left font-medium">
                        {{ t({ en: "Type", ru: "Тип" }) }}
                      </th>
                      <th class="px-5 py-3 text-left font-medium">
                        {{ t({ en: "Required", ru: "Обязательное" }) }}
                      </th>
                      <th class="px-5 py-3 text-left font-medium">
                        {{ t({ en: "Default", ru: "По умолчанию" }) }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="entry in regularFieldEntries"
                      :key="`${entry.field.name}-${entry.index}`"
                      class="border-default cursor-pointer border-t transition-colors"
                      :class="
                        selectedFieldIndex === entry.index ? 'bg-primary/5' : 'hover:bg-elevated/40'
                      "
                      @click="selectRegularField(entry.index)"
                    >
                      <td class="px-5 py-4">
                        <div class="flex items-center gap-2">
                          <span class="font-medium">{{ entry.field.name }}</span>
                          <UBadge
                            v-if="getFieldIssueCount(entry.index) > 0"
                            :label="getIssueCountLabel(getFieldIssueCount(entry.index))"
                            color="error"
                            variant="subtle"
                            size="sm"
                          />
                        </div>
                      </td>
                      <td class="px-5 py-4 font-mono text-xs">{{ entry.field.type }}</td>
                      <td class="px-5 py-4">
                        <UBadge
                          :label="
                            entry.field.required === true
                              ? t({ en: 'Required', ru: 'Да' })
                              : t({ en: 'Optional', ru: 'Нет' })
                          "
                          color="primary"
                          variant="subtle"
                          size="sm"
                        />
                      </td>
                      <td class="px-5 py-4">
                        <span class="text-muted block max-w-[240px] truncate font-mono text-xs">
                          {{ getFieldDefaultPreview(entry.field.default) }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <aside
              class="border-default bg-default flex min-h-0 flex-col overflow-hidden rounded-3xl border p-5 shadow-sm"
            >
              <div
                v-if="!selectedRegularField || selectedFieldIndex === null"
                class="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-center"
              >
                <UIcon name="i-lucide-mouse-pointer-click" class="text-muted h-10 w-10" />
                <p class="text-muted text-sm">
                  {{
                    t({
                      en: "Select a field to edit its details",
                      ru: "Выбери поле, чтобы редактировать его детали",
                    })
                  }}
                </p>
              </div>

              <div v-else class="min-h-0 flex-1 overflow-auto">
                <div class="flex flex-col gap-5">
                  <div>
                    <div class="mb-2 flex items-center gap-2">
                      <h3 class="text-base font-semibold">
                        {{ t({ en: "Field settings", ru: "Настройки поля" }) }}
                      </h3>
                      <UBadge
                        :label="selectedRegularField.type"
                        color="primary"
                        variant="soft"
                        size="sm"
                      />
                    </div>
                    <p class="text-muted text-sm">
                      {{ getFieldTypeHint(selectedRegularField.type) }}
                    </p>
                  </div>

                  <div
                    v-if="fieldIssuesByIndex[selectedFieldIndex]?.length"
                    class="border-error/30 bg-error/5 text-error rounded-2xl border p-4 text-sm"
                  >
                    <p class="font-medium">{{ t({ en: "Field issues", ru: "Ошибки поля" }) }}</p>
                    <ul class="mt-2 flex list-disc flex-col gap-1 pl-5">
                      <li v-for="issue in fieldIssuesByIndex[selectedFieldIndex]" :key="issue">
                        {{ issue }}
                      </li>
                    </ul>
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium">{{
                      t({ en: "Field name", ru: "Имя поля" })
                    }}</label>
                    <UInput
                      :model-value="selectedRegularField.name"
                      @blur="handleUpdateFieldName(selectedFieldIndex, $event)"
                      @keyup.enter="handleUpdateFieldName(selectedFieldIndex, $event)"
                    />
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium">{{ t({ en: "Type", ru: "Тип" }) }}</label>
                    <USelect
                      :model-value="selectedRegularField.type"
                      :items="fieldTypeItems"
                      value-key="value"
                      label-key="label"
                      @update:model-value="handleUpdateFieldType(selectedFieldIndex, $event)"
                    />
                  </div>

                  <div class="border-default rounded-2xl border p-4">
                    <div class="mb-2 flex items-center justify-between gap-4">
                      <div>
                        <p class="text-sm font-medium">
                          {{ t({ en: "Required", ru: "Обязательное" }) }}
                        </p>
                        <p class="text-muted mt-1 text-xs">
                          {{
                            t({
                              en: "Turn this on if the field must be filled in.",
                              ru: "Включай это, если поле обязательно нужно заполнить.",
                            })
                          }}
                        </p>
                      </div>
                      <USwitch
                        :model-value="selectedRegularField.required === true"
                        @update:model-value="
                          handleUpdateFieldRequired(selectedFieldIndex, Boolean($event))
                        "
                      />
                    </div>
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium">{{
                      t({ en: "Default value", ru: "Значение по умолчанию" })
                    }}</label>

                    <USelect
                      v-if="isBooleanFieldType(selectedRegularField.type)"
                      :model-value="getBooleanDefaultValue(selectedRegularField.default)"
                      :items="booleanDefaultItems"
                      value-key="value"
                      label-key="label"
                      @update:model-value="
                        handleUpdateFieldBooleanDefault(selectedFieldIndex, $event)
                      "
                    />

                    <UTextarea
                      v-else-if="isMultilineFieldType(selectedRegularField.type)"
                      :model-value="serializeDefaultValue(selectedRegularField.default)"
                      :rows="selectedRegularField.type === 'json' ? 7 : 4"
                      :placeholder="getFieldDefaultPlaceholder(selectedRegularField.type)"
                      @blur="
                        handleUpdateFieldDefault(
                          selectedFieldIndex,
                          selectedRegularField.type,
                          $event,
                        )
                      "
                    />

                    <UInput
                      v-else
                      :model-value="serializeDefaultValue(selectedRegularField.default)"
                      :type="isNumericFieldType(selectedRegularField.type) ? 'number' : 'text'"
                      :placeholder="getFieldDefaultPlaceholder(selectedRegularField.type)"
                      @blur="
                        handleUpdateFieldDefault(
                          selectedFieldIndex,
                          selectedRegularField.type,
                          $event,
                        )
                      "
                    />

                    <p class="text-muted text-xs">
                      {{ getFieldTypeHint(selectedRegularField.type) }}
                    </p>
                  </div>

                  <div class="border-default mt-2 border-t pt-4">
                    <UButton
                      color="error"
                      variant="outline"
                      size="sm"
                      icon="i-lucide-trash-2"
                      @click="openDeleteFieldModal(selectedFieldIndex)"
                    >
                      {{ t({ en: "Delete field", ru: "Удалить поле" }) }}
                    </UButton>
                  </div>
                </div>
              </div>
            </aside>
          </section>

          <section v-else-if="activeTab === 'relations'" class="flex min-h-0 flex-1 flex-col gap-6">
            <div class="grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_500px]">
              <div
                class="border-default bg-default flex min-h-0 flex-col overflow-hidden rounded-3xl border shadow-sm"
              >
                <div
                  class="border-default flex items-center justify-between gap-4 border-b px-5 py-4"
                >
                  <div>
                    <h3 class="text-base font-semibold">
                      {{ t({ en: "Relations", ru: "Связи" }) }}
                    </h3>
                    <p class="text-muted mt-1 text-sm">
                      {{
                        t({
                          en: "Each card is one link from this collection to another collection.",
                          ru: "Каждая карточка — это одна связь из этой коллекции в другую коллекцию.",
                        })
                      }}
                    </p>
                  </div>

                  <div class="flex items-center gap-3">
                    <UButton size="sm" icon="i-lucide-plus" @click="handleCreateRelationField()">
                      {{ t({ en: "Add relation", ru: "Добавить связь" }) }}
                    </UButton>
                  </div>
                </div>

                <div
                  v-if="relationFieldEntries.length === 0"
                  class="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center"
                >
                  <UIcon name="i-lucide-git-compare-arrows" class="text-primary/70 h-12 w-12" />
                  <div class="max-w-2xl">
                    <p class="text-base font-medium">
                      {{ t({ en: "No relations yet", ru: "Пока нет связей" }) }}
                    </p>
                    <p class="text-muted mt-2 text-sm leading-6">
                      {{ getRelationEmptyStateDescription() }}
                    </p>
                  </div>

                  <div class="mt-2 flex flex-wrap justify-center gap-2">
                    <UButton size="sm" @click="handleCreateRelationField()">
                      {{ t({ en: "Create relation", ru: "Создать связь" }) }}
                    </UButton>
                    <UButton
                      v-for="suggestion in relationTargetSuggestions"
                      :key="suggestion.value"
                      size="sm"
                      variant="outline"
                      @click="handleCreateRelationField(suggestion.value)"
                    >
                      {{ suggestion.label }}
                    </UButton>
                  </div>
                </div>

                <div
                  v-else
                  class="grid min-h-0 flex-1 content-start gap-4 overflow-auto p-4 lg:grid-cols-2"
                >
                  <button
                    v-for="entry in relationFieldEntries"
                    :key="`${entry.field.name}-${entry.index}`"
                    class="border-default group rounded-3xl border p-4 text-left transition-all"
                    :class="
                      selectedFieldIndex === entry.index
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'bg-default hover:border-primary/40 hover:bg-elevated/40'
                    "
                    @click="selectRelationField(entry.index)"
                  >
                    <div class="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p class="text-sm font-semibold">{{ entry.field.name }}</p>
                        <p class="text-muted mt-1 text-xs">
                          {{ getRelationFieldSummary(entry.field) }}
                        </p>
                      </div>

                      <div class="flex flex-col items-end gap-1">
                        <UBadge
                          :label="
                            entry.field.required === true
                              ? t({ en: 'Required', ru: 'Обязательная' })
                              : t({ en: 'Optional', ru: 'Необязательная' })
                          "
                          :color="getRelationBadgeColor(entry.field)"
                          variant="subtle"
                          size="sm"
                        />
                        <UBadge
                          v-if="getFieldIssueCount(entry.index) > 0"
                          :label="getIssueCountLabel(getFieldIssueCount(entry.index))"
                          color="error"
                          variant="subtle"
                          size="sm"
                        />
                      </div>
                    </div>

                    <div
                      class="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
                    >
                      <div class="border-default bg-elevated/40 rounded-2xl border px-3 py-3">
                        <p class="text-muted text-[11px] tracking-wide uppercase">
                          {{ t({ en: "From", ru: "Из" }) }}
                        </p>
                        <p class="mt-1 truncate text-sm font-medium">
                          {{ getCollectionName(selectedCollection) }}
                        </p>
                      </div>

                      <div class="text-primary flex flex-col items-center gap-1">
                        <UIcon name="i-lucide-arrow-right" class="h-4 w-4" />
                        <span
                          class="bg-primary/10 rounded-full px-2 py-1 text-[11px] font-medium"
                          >{{ entry.field.name }}</span
                        >
                      </div>

                      <div class="border-default bg-default rounded-2xl border px-3 py-3">
                        <p class="text-muted text-[11px] tracking-wide uppercase">
                          {{ t({ en: "To", ru: "В" }) }}
                        </p>
                        <p class="mt-1 truncate text-sm font-medium">
                          {{ getRelationTargetCollectionName(entry.field) }}
                        </p>
                      </div>
                    </div>

                    <div class="text-muted mt-4 flex items-center justify-between text-xs">
                      <span>
                        {{
                          t({
                            en: "Use this when one record should point to another collection.",
                            ru: "Используй это, когда одна запись должна ссылаться на другую коллекцию.",
                          })
                        }}
                      </span>
                      <UIcon
                        :name="
                          selectedFieldIndex === entry.index
                            ? 'i-lucide-check-circle-2'
                            : 'i-lucide-arrow-up-right'
                        "
                        class="h-4 w-4 shrink-0"
                      />
                    </div>
                  </button>
                </div>
              </div>

              <aside
                class="border-default bg-default flex min-h-0 flex-col overflow-hidden rounded-3xl border p-5 shadow-sm"
              >
                <div
                  v-if="!selectedRelationField || selectedFieldIndex === null"
                  class="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 text-center"
                >
                  <UIcon name="i-lucide-waypoints" class="text-primary/70 h-10 w-10" />
                  <p class="text-muted text-sm">
                    {{
                      t({
                        en: "Select a relation card to edit the link",
                        ru: "Выбери карточку связи, чтобы настроить связь",
                      })
                    }}
                  </p>
                </div>

                <div v-else class="min-h-0 flex-1 overflow-auto">
                  <div class="flex flex-col gap-5">
                    <div>
                      <div class="mb-2 flex items-center gap-2">
                        <h3 class="text-base font-semibold">
                          {{ t({ en: "Relation settings", ru: "Настройки связи" }) }}
                        </h3>
                        <UBadge
                          :label="selectedRelationField.type"
                          color="primary"
                          variant="soft"
                          size="sm"
                        />
                      </div>
                      <p class="text-muted text-sm leading-6">
                        {{
                          t({
                            en: "Give the link a clear name and choose where it should lead.",
                            ru: "Дай связи понятное имя и выбери, куда она должна вести.",
                          })
                        }}
                      </p>
                    </div>

                    <div class="border-primary/20 bg-primary/5 rounded-3xl border p-4">
                      <p class="text-muted text-[11px] tracking-wide uppercase">
                        {{ t({ en: "Relation flow", ru: "Схема связи" }) }}
                      </p>
                      <div
                        class="mt-3 grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
                      >
                        <div class="border-default bg-default rounded-2xl border px-3 py-3">
                          <p class="text-muted text-[11px] tracking-wide uppercase">
                            {{ t({ en: "Source", ru: "Источник" }) }}
                          </p>
                          <p class="mt-1 truncate text-sm font-medium">
                            {{ getCollectionName(selectedCollection) }}
                          </p>
                        </div>

                        <div class="text-primary flex flex-col items-center gap-1">
                          <UIcon name="i-lucide-arrow-right" class="h-4 w-4" />
                          <span
                            class="bg-primary/10 rounded-full px-2 py-1 text-[11px] font-medium"
                            >{{ selectedRelationField.name }}</span
                          >
                        </div>

                        <div class="border-default bg-default rounded-2xl border px-3 py-3">
                          <p class="text-muted text-[11px] tracking-wide uppercase">
                            {{ t({ en: "Target", ru: "Цель" }) }}
                          </p>
                          <p class="mt-1 truncate text-sm font-medium">
                            {{ getRelationTargetCollectionName(selectedRelationField) }}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div
                      v-if="fieldIssuesByIndex[selectedFieldIndex]?.length"
                      class="border-error/30 bg-error/5 text-error rounded-2xl border p-4 text-sm"
                    >
                      <p class="font-medium">
                        {{ t({ en: "Relation issues", ru: "Ошибки связи" }) }}
                      </p>
                      <ul class="mt-2 flex list-disc flex-col gap-1 pl-5">
                        <li v-for="issue in fieldIssuesByIndex[selectedFieldIndex]" :key="issue">
                          {{ issue }}
                        </li>
                      </ul>
                    </div>

                    <div class="flex flex-col gap-2">
                      <label class="text-sm font-medium">{{
                        t({ en: "Relation field name", ru: "Имя relation-поля" })
                      }}</label>
                      <UInput
                        :model-value="selectedRelationField.name"
                        @blur="handleUpdateFieldName(selectedFieldIndex, $event)"
                        @keyup.enter="handleUpdateFieldName(selectedFieldIndex, $event)"
                      />
                      <p class="text-muted text-xs">
                        {{
                          t({
                            en: "Use a clear name like author, category, owner or parent.",
                            ru: "Используй понятные имена: author, category, owner, parent и так далее.",
                          })
                        }}
                      </p>
                    </div>

                    <div class="flex flex-col gap-2">
                      <label class="text-sm font-medium">{{
                        t({ en: "Target collection", ru: "Целевая коллекция" })
                      }}</label>
                      <USelect
                        :model-value="getRelationCollectionValue(selectedRelationField)"
                        :items="
                          getRelationCollectionItems(
                            getRelationCollectionValue(selectedRelationField),
                          )
                        "
                        value-key="value"
                        label-key="label"
                        @update:model-value="
                          handleUpdateFieldRelationCollection(selectedFieldIndex, $event)
                        "
                      />
                      <p class="text-muted text-xs">
                        {{
                          t({
                            en: "Choose which collection this field should link to.",
                            ru: "Выбери, к какой коллекции должно вести это поле.",
                          })
                        }}
                      </p>
                    </div>

                    <div class="border-default rounded-2xl border p-4">
                      <div class="mb-2 flex items-center justify-between gap-4">
                        <div>
                          <p class="text-sm font-medium">
                            {{ t({ en: "Required", ru: "Обязательная" }) }}
                          </p>
                          <p class="text-muted mt-1 text-xs">
                            {{
                              t({
                                en: "Turn this on if every record must have this link filled in.",
                                ru: "Включай это, если у каждой записи эта связь должна быть заполнена.",
                              })
                            }}
                          </p>
                        </div>
                        <USwitch
                          :model-value="selectedRelationField.required === true"
                          @update:model-value="
                            handleUpdateFieldRequired(selectedFieldIndex, Boolean($event))
                          "
                        />
                      </div>
                    </div>

                    <div class="flex flex-col gap-2">
                      <label class="text-sm font-medium">{{
                        t({
                          en: "Default linked record ID",
                          ru: "ID связанной записи по умолчанию",
                        })
                      }}</label>
                      <UInput
                        :model-value="serializeDefaultValue(selectedRelationField.default)"
                        :placeholder="getFieldDefaultPlaceholder(selectedRelationField.type)"
                        @blur="
                          handleUpdateFieldDefault(
                            selectedFieldIndex,
                            selectedRelationField.type,
                            $event,
                          )
                        "
                      />
                      <p class="text-muted text-xs">
                        {{
                          t({
                            en: "Usually left empty. Use only when a stable default relation really exists.",
                            ru: "Обычно оставляют пустым. Используй только если действительно есть стабильная связь по умолчанию.",
                          })
                        }}
                      </p>
                    </div>

                    <div class="border-default mt-2 border-t pt-4">
                      <UButton
                        color="error"
                        variant="outline"
                        size="sm"
                        icon="i-lucide-trash-2"
                        @click="openDeleteFieldModal(selectedFieldIndex)"
                      >
                        {{ t({ en: "Delete relation", ru: "Удалить связь" }) }}
                      </UButton>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <section v-else-if="activeTab === 'manifest'" class="flex min-h-0 flex-1 flex-col">
            <div
              class="border-default bg-default flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border shadow-sm"
            >
              <div class="border-default border-b px-5 py-4">
                <h3 class="text-base font-semibold">{{ t({ en: "Manifest", ru: "Манифест" }) }}</h3>
                <p class="text-muted mt-1 text-sm">
                  {{
                    t({
                      en: "Current project structure as JSON.",
                      ru: "Текущая структура проекта в JSON.",
                    })
                  }}
                </p>
              </div>

              <div class="min-h-0 flex-1 overflow-auto">
                <pre
                  class="min-h-full p-5 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap"
                  >{{ manifestPreview }}</pre
                >
              </div>
            </div>
          </section>

          <section
            v-else
            class="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-4 overflow-auto pr-1"
          >
            <div class="border-default bg-default rounded-3xl border p-5 shadow-sm">
              <div class="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-base font-semibold">
                    {{ t({ en: "Collection", ru: "Коллекция" }) }}
                  </h3>
                  <p class="text-muted mt-1 text-sm">
                    {{
                      t({
                        en: "Give the collection a clear name and a short stable ID.",
                        ru: "Дай коллекции понятное имя и короткий стабильный ID.",
                      })
                    }}
                  </p>
                </div>

                <UButton
                  color="error"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-trash-2"
                  @click="openDeleteCollectionModal"
                >
                  {{ t({ en: "Delete", ru: "Удалить" }) }}
                </UButton>
              </div>

              <div
                v-if="selectedCollectionIssues.length > 0"
                class="border-error/30 bg-error/5 text-error mb-5 rounded-2xl border p-4 text-sm"
              >
                <p class="font-medium">
                  {{ t({ en: "Collection issues", ru: "Ошибки коллекции" }) }}
                </p>
                <ul class="mt-2 flex list-disc flex-col gap-1 pl-5">
                  <li v-for="issue in selectedCollectionIssues" :key="issue">{{ issue }}</li>
                </ul>
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <div class="flex flex-col gap-2">
                  <label class="text-sm font-medium">{{ t({ en: "Name", ru: "Название" }) }}</label>
                  <UInput
                    :model-value="(selectedCollection.data.name as string | undefined) ?? ''"
                    @blur="handleUpdateCollectionName($event)"
                    @keyup.enter="handleUpdateCollectionName($event)"
                  />
                </div>

                <div class="flex flex-col gap-2">
                  <label class="text-sm font-medium">{{
                    t({ en: "Collection ID", ru: "ID коллекции" })
                  }}</label>
                  <UInput
                    :model-value="getCollectionManifestId(selectedCollection)"
                    @blur="handleUpdateCollectionManifestId($event)"
                    @keyup.enter="handleUpdateCollectionManifestId($event)"
                  />
                  <p class="text-muted text-xs">
                    {{
                      t({
                        en: "Use this ID in links and references. Better set it once and keep it stable.",
                        ru: "Используй этот ID в связях и ссылках. Лучше задать его один раз и потом не менять.",
                      })
                    }}
                  </p>
                </div>

                <div class="flex flex-col gap-2 md:col-span-2">
                  <label class="text-sm font-medium">{{
                    t({ en: "Description", ru: "Описание" })
                  }}</label>
                  <UTextarea
                    :model-value="(selectedCollection.data.description as string | undefined) ?? ''"
                    :rows="4"
                    @blur="handleUpdateCollectionDescription($event)"
                  />
                </div>
              </div>
            </div>

            <div class="border-default bg-default rounded-3xl border p-5 shadow-sm">
              <h3 class="text-base font-semibold">{{ t({ en: "Behavior", ru: "Поведение" }) }}</h3>
              <div class="mt-4 flex flex-col gap-3">
                <div class="border-default rounded-2xl border p-4">
                  <div class="mb-2 flex items-center justify-between gap-4">
                    <p class="text-sm font-medium">
                      {{ t({ en: "One record", ru: "Одна запись" }) }}
                    </p>
                    <USwitch
                      :model-value="selectedCollection.data.singleton === true"
                      @update:model-value="handleUpdateSingleton(Boolean($event))"
                    />
                  </div>
                  <p class="text-muted text-xs">
                    {{
                      t({
                        en: "Turn this on for settings or any other single shared record.",
                        ru: "Включай это для настроек или любой другой общей одиночной записи.",
                      })
                    }}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>

    <UModal
      v-model:open="deleteCollectionModalOpen"
      :title="t({ en: 'Delete collection?', ru: 'Удалить коллекцию?' })"
      :description="deleteCollectionDescription"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton variant="ghost" @click="closeDeleteCollectionModal">{{
            t({ en: "Cancel", ru: "Отмена" })
          }}</UButton>
          <UButton color="error" @click="confirmDeleteCollection">{{
            t({ en: "Delete", ru: "Удалить" })
          }}</UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="deleteFieldModalOpen"
      :title="t({ en: 'Delete field?', ru: 'Удалить поле?' })"
      :description="deleteFieldDescription"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton variant="ghost" @click="closeDeleteFieldModal">{{
            t({ en: "Cancel", ru: "Отмена" })
          }}</UButton>
          <UButton color="error" @click="confirmDeleteField">{{
            t({ en: "Delete", ru: "Удалить" })
          }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
