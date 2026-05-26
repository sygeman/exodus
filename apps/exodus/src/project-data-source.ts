import {
  manifestFieldInputSchema,
  getGeneratedFieldName,
  type FieldType,
  type DataManifest,
  type ManifestCollection,
  type ManifestField,
  type RelationField,
} from "@/project-manifest-schemas"

export type ProjectDataCollectionSourceItem = {
  id: string
  data: {
    project_id?: unknown
    manifest_id?: unknown
    name?: unknown
    singleton?: unknown
    fields?: unknown
    labels?: unknown
    description?: unknown
    icon?: unknown
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const entries = Object.entries(value).filter((entry): entry is [string, string] => {
    return typeof entry[1] === "string"
  })

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function splitFieldOptions(
  type: FieldType,
  options: Record<string, unknown> | undefined,
): {
  options?: Record<string, unknown>
  relation?: RelationField
} {
  if (type !== "relation" || !options) {
    return { options }
  }

  const nextOptions = { ...options }
  const collection =
    typeof nextOptions.collection === "string" && nextOptions.collection.trim() !== ""
      ? nextOptions.collection
      : typeof nextOptions.target_collection_id === "string" &&
          nextOptions.target_collection_id.trim() !== ""
        ? nextOptions.target_collection_id
        : undefined
  const kind =
    nextOptions.kind === "many" || nextOptions.kind === "one" ? nextOptions.kind : undefined

  delete nextOptions.collection
  delete nextOptions.target_collection_id
  delete nextOptions.kind

  return {
    options: Object.keys(nextOptions).length > 0 ? nextOptions : undefined,
    relation: collection ? { collection, ...(kind ? { kind } : {}) } : undefined,
  }
}

function normalizeProjectDataField(value: unknown): ManifestField | null {
  const parsed = manifestFieldInputSchema.safeParse(value)
  if (!parsed.success) {
    return null
  }

  const { options, relation } = splitFieldOptions(parsed.data.type, parsed.data.options)

  const field = {
    ...parsed.data,
    options,
    relation: parsed.data.relation ?? relation,
  }

  return field.special ? { ...field, name: getGeneratedFieldName(field.special) } : field
}

export function normalizeProjectDataFields(value: unknown): ManifestField[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    const parsed = normalizeProjectDataField(entry)
    return parsed ? [parsed] : []
  })
}

export function toProjectDataCollectionManifest(
  item: ProjectDataCollectionSourceItem,
): ManifestCollection {
  const manifestId =
    typeof item.data.manifest_id === "string" && item.data.manifest_id.trim() !== ""
      ? item.data.manifest_id
      : item.id

  const name =
    typeof item.data.name === "string" && item.data.name.trim() !== "" ? item.data.name : manifestId

  return {
    id: manifestId,
    name,
    singleton: item.data.singleton === true || undefined,
    fields: normalizeProjectDataFields(item.data.fields),
    labels: getStringRecord(item.data.labels),
    description:
      typeof item.data.description === "string" && item.data.description.trim() !== ""
        ? item.data.description
        : undefined,
    icon:
      typeof item.data.icon === "string" && item.data.icon.trim() !== ""
        ? item.data.icon
        : undefined,
  }
}

export function buildProjectDataManifest(items: ProjectDataCollectionSourceItem[]): DataManifest {
  return {
    collections: items.map((item) => toProjectDataCollectionManifest(item)),
  }
}
