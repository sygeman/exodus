import { mkdir, mkdtemp, open } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { pathToFileURL } from "node:url"
import { z } from "zod"
import { eq, and, desc, asc, isNull, isNotNull } from "drizzle-orm"
import { createEdemModule } from "@exodus/edem-core"
import { createDataEngine, type DataEngine } from "./db"
import * as schema from "./schema"
import { createFileStorage } from "./storage"
import {
  fieldSchema,
  fieldInputSchema,
  fieldSpecials,
  fieldTypes,
  labelsSchema,
  relationFieldSchema,
  type ManifestField,
  type RelationField,
  validateFieldDataValue,
  manifestSchema,
  type FieldSpecial,
  type FieldType,
} from "./fields"
import { matchFilter, sortItems, filterSchema, sortSchema } from "./filters"
import { resolveLocalizedData } from "./locale"

function safeJsonParse<T>(value: string, context: string): T {
  try {
    return JSON.parse(value) as T
  } catch {
    throw new Error(`Failed to parse JSON in ${context}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const fileHashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const thumbnailSizes = ["small", "medium", "large"] as const
const thumbnailSizeSchema = z.enum(thumbnailSizes)
const fileMetadataSchema = z.record(z.string(), z.unknown())
const uploadIdSchema = z.string().uuid()
const recommendedFileChunkBytes = 256 * 1024
const maxFileChunkBytes = 1024 * 1024

type ThumbnailSize = (typeof thumbnailSizes)[number]

type FileUploadSession = {
  id: string
  path: string
  originalName: string
  mimeType: string
  size?: number
  uploadedBytes: number
  createdAt: number
}

const thumbnailDimensions: Record<ThumbnailSize, { width: number; height: number }> = {
  small: { width: 150, height: 150 },
  medium: { width: 400, height: 400 },
  large: { width: 800, height: 800 },
}

function serializeMetadata(value: Record<string, unknown> | undefined): string | null {
  return value && Object.keys(value).length > 0 ? JSON.stringify(value) : null
}

async function ensureParentDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
}

async function removeFilePath(path: string): Promise<void> {
  try {
    await Bun.file(path).delete()
  } catch {
    // The database row is the source of truth; missing files are already gone.
  }
}

function decodeBase64Chunk(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"))
}

async function writeUploadChunk(path: string, offset: number, data: Uint8Array): Promise<void> {
  const file = await open(path, "r+")

  try {
    const result = await file.write(data, 0, data.byteLength, offset)
    if (result.bytesWritten !== data.byteLength) {
      throw new Error(`Failed to write full upload chunk to "${path}"`)
    }
  } finally {
    await file.close()
  }
}

async function readBase64Chunk(input: {
  path: string
  total: number
  offset: number
  length: number
}): Promise<{ data_base64: string; length: number; done: boolean }> {
  if (input.offset > input.total) {
    throw new Error(`Chunk offset ${input.offset} exceeds file size ${input.total}`)
  }

  const end = Math.min(input.offset + input.length, input.total)
  const data = await Bun.file(input.path).slice(input.offset, end).arrayBuffer()
  const bytes = Buffer.from(data)

  return {
    data_base64: bytes.toString("base64"),
    length: bytes.byteLength,
    done: end >= input.total,
  }
}

async function extractImageMetadata(
  path: string,
  mimeType: string,
): Promise<{ width?: number; height?: number; metadata?: Record<string, unknown> }> {
  if (!mimeType.startsWith("image/")) {
    return {}
  }

  try {
    const imageMetadata = await Bun.file(path).image().metadata()
    const metadata: Record<string, unknown> = {}

    if (imageMetadata.format) {
      metadata.format = imageMetadata.format
    }

    return {
      width: imageMetadata.width,
      height: imageMetadata.height,
      metadata,
    }
  } catch {
    return {}
  }
}

function getThumbnailPath(thumbnailsDir: string, hash: string, size: ThumbnailSize): string {
  return join(thumbnailsDir, hash.slice(0, 2), `${hash}_${size}.webp`)
}

async function writeImageThumbnail(
  sourcePath: string,
  targetPath: string,
  dimensions: { width: number; height: number },
): Promise<{ width: number; height: number }> {
  await ensureParentDir(targetPath)

  await Bun.file(sourcePath)
    .image()
    .resize(dimensions.width, dimensions.height, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .write(targetPath)

  const metadata = await Bun.file(targetPath).image().metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error(`Failed to read thumbnail metadata for "${targetPath}"`)
  }

  return { width: metadata.width, height: metadata.height }
}

function parseFieldSpecial(value: string | null | undefined): FieldSpecial | undefined {
  return fieldSpecials.find((special) => special === value)
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

function mergeFieldOptions(
  type: FieldType,
  options: Record<string, unknown> | undefined,
  relation: RelationField | undefined,
): Record<string, unknown> | undefined {
  const nextOptions = options ? { ...options } : {}

  if (type === "relation") {
    delete nextOptions.target_collection_id

    if (relation?.collection.trim()) {
      nextOptions.collection = relation.collection.trim()
      if (relation.kind) {
        nextOptions.kind = relation.kind
      } else {
        delete nextOptions.kind
      }
    } else {
      delete nextOptions.collection
      delete nextOptions.kind
    }
  }

  return Object.keys(nextOptions).length > 0 ? nextOptions : undefined
}

function serializeFieldDefaultValue(value: unknown): string | null {
  return value !== null && value !== undefined ? JSON.stringify(value) : null
}

function serializeFieldOptions(
  type: FieldType,
  options: Record<string, unknown> | undefined,
  relation: RelationField | undefined,
): string | null {
  const mergedOptions = mergeFieldOptions(type, options, relation)
  return mergedOptions ? JSON.stringify(mergedOptions) : null
}

function parseFieldOptions(
  raw: string | null,
  context: string,
): Record<string, unknown> | undefined {
  if (!raw) {
    return undefined
  }

  const parsed = safeJsonParse<unknown>(raw, context)
  return isRecord(parsed) ? parsed : undefined
}

function parseStoredField(field: {
  id: string
  collection_id: string
  name: string
  labels: string | null
  type: string
  interface_options: string | null
  required: boolean | null
  hidden: boolean | null
  readonly: boolean | null
  system: boolean | null
  special: string | null
  default_value: string | null
  meta: string | null
}): z.infer<typeof fieldSchema> {
  const type = field.type as FieldType
  const parsedOptions = parseFieldOptions(field.interface_options, `field ${field.id} options`)
  const { options, relation } = splitFieldOptions(type, parsedOptions)

  return {
    id: field.id,
    collection_id: field.collection_id,
    name: field.name,
    labels: field.labels
      ? safeJsonParse<Record<string, string>>(field.labels, `field ${field.id} labels`)
      : undefined,
    type,
    relation,
    options,
    required: field.required ?? undefined,
    hidden: field.hidden === true ? true : undefined,
    readonly: field.readonly === true ? true : undefined,
    system: field.system === true ? true : undefined,
    special: parseFieldSpecial(field.special),
    default: field.default_value
      ? safeJsonParse(field.default_value, `field ${field.id} default_value`)
      : undefined,
    meta: field.meta
      ? safeJsonParse<Record<string, unknown>>(field.meta, `field ${field.id} meta`)
      : undefined,
  }
}

function parseStoredManifestField(field: {
  id: string
  collection_id: string
  name: string
  labels: string | null
  type: string
  interface_options: string | null
  required: boolean | null
  hidden: boolean | null
  readonly: boolean | null
  system: boolean | null
  special: string | null
  default_value: string | null
  meta: string | null
}): ManifestField {
  const parsed = parseStoredField(field)

  return {
    name: parsed.name,
    labels: parsed.labels,
    type: parsed.type,
    relation: parsed.relation,
    required: parsed.required,
    hidden: parsed.hidden,
    readonly: parsed.readonly,
    system: parsed.system,
    special: parsed.special,
    default: parsed.default,
    options: parsed.options,
    meta: parsed.meta,
  }
}

type DataFieldDefinition = {
  name: string
  type: string
  required?: boolean | null
  special?: string | null
  relation?: RelationField | null
  options?: Record<string, unknown>
  interface_options?: string | null
}

function hasStoredValue(value: unknown): boolean {
  return value !== null && value !== undefined
}

function formatSystemTimestamp(value: number): string {
  return new Date(value).toISOString()
}

function getGeneratedFieldValue(
  field: DataFieldDefinition,
  context: {
    itemId: string
    now: number
    createdAt?: number
    currentData?: Record<string, unknown>
  },
): unknown {
  const currentValue = context.currentData?.[field.name]

  switch (parseFieldSpecial(field.special)) {
    case "uuid":
      if (hasStoredValue(currentValue)) {
        return currentValue
      }
      return field.name === "id" ? context.itemId : crypto.randomUUID()

    case "date-created":
      if (hasStoredValue(currentValue)) {
        return currentValue
      }
      return formatSystemTimestamp(context.createdAt ?? context.now)

    case "date-updated":
      return formatSystemTimestamp(context.now)

    default:
      return undefined
  }
}

function applyGeneratedFieldValues(
  data: Record<string, unknown>,
  fields: DataFieldDefinition[],
  context: {
    itemId: string
    now: number
    createdAt?: number
    currentData?: Record<string, unknown>
  },
): Record<string, unknown> {
  const nextData = { ...data }

  for (const field of fields) {
    const value = getGeneratedFieldValue(field, context)
    if (value !== undefined) {
      nextData[field.name] = value
    }
  }

  return nextData
}

function buildUpdatedFieldValidationNames(
  inputData: Record<string, unknown>,
  fields: DataFieldDefinition[],
): Set<string> {
  return new Set([
    ...Object.keys(inputData),
    ...fields.flatMap((field) => (parseFieldSpecial(field.special) ? [field.name] : [])),
  ])
}

function getDataFieldRelation(field: DataFieldDefinition): RelationField | undefined {
  if (field.relation) {
    return field.relation
  }

  const fieldType = field.type as FieldType
  const options =
    field.options ??
    (field.interface_options
      ? parseFieldOptions(field.interface_options, `field ${field.name} options`)
      : undefined)

  return splitFieldOptions(fieldType, options).relation
}

function isMissingRequiredFieldValue(field: DataFieldDefinition, value: unknown): boolean {
  if (value === null || value === undefined) {
    return true
  }

  const fieldType = field.type as FieldType
  const relation = getDataFieldRelation(field)
  return (
    fieldType === "relation" &&
    relation?.kind === "many" &&
    Array.isArray(value) &&
    value.length === 0
  )
}

function validateItemData(
  fields: DataFieldDefinition[],
  data: Record<string, unknown>,
  options: { validateFieldNames?: Set<string> } = {},
): void {
  for (const field of fields) {
    const value = data[field.name]
    if (field.required && isMissingRequiredFieldValue(field, value)) {
      throw new Error(`Field "${field.name}" is required`)
    }
    if (options.validateFieldNames && !options.validateFieldNames.has(field.name)) {
      continue
    }
    const fieldType = field.type as FieldType
    if (
      value !== undefined &&
      !validateFieldDataValue({ type: fieldType, relation: getDataFieldRelation(field) }, value)
    ) {
      throw new Error(`Invalid value for field "${field.name}" of type "${field.type}"`)
    }
  }
}

const collectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  labels: labelsSchema.optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  singleton: z.boolean().nullable().optional(),
  system: z.boolean().nullable().optional(),
  schema_version: z.number().nullable().optional(),
  default_sort_field: z.string().nullable().optional(),
  default_sort_dir: z.enum(["asc", "desc"]).nullable().optional(),
  fields: z.array(fieldSchema),
  meta: z.record(z.string(), z.any()).optional(),
  created_at: z.number(),
  updated_at: z.number(),
  deleted_at: z.number().nullable().optional(),
})

const itemSchema = z.object({
  id: z.string(),
  collection_id: z.string(),
  schema_version: z.number().nullable().optional(),
  source: z.string().nullable().optional(),
  data: z.record(z.string(), z.any()),
  created_at: z.number(),
  updated_at: z.number(),
  deleted_at: z.number().nullable().optional(),
})

const relationSchema = z.object({
  id: z.string(),
  source_item_id: z.string(),
  source_field_id: z.string(),
  target_item_id: z.string(),
  target_collection_id: z.string(),
  sort_order: z.number().nullable().optional(),
  created_at: z.number(),
})

const itemVersionSchema = z.object({
  id: z.string(),
  item_id: z.string(),
  version: z.number(),
  data: z.record(z.string(), z.any()),
  source: z.string().nullable().optional(),
  created_at: z.number(),
})

const itemLockSchema = z.object({
  id: z.string(),
  item_id: z.string(),
  locked_by: z.string(),
  reason: z.string().nullable().optional(),
  expires_at: z.number(),
  created_at: z.number(),
})

const fileSchema = z.object({
  hash: fileHashSchema,
  original_name: z.string(),
  mime_type: z.string(),
  size: z.number(),
  storage_path: z.string(),
  ref_count: z.number().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  duration: z.number().nullable().optional(),
  frame_rate: z.number().nullable().optional(),
  video_codec: z.string().nullable().optional(),
  audio_codec: z.string().nullable().optional(),
  bitrate: z.number().nullable().optional(),
  sample_rate: z.number().nullable().optional(),
  channels: z.number().nullable().optional(),
  orientation: z.number().nullable().optional(),
  color_space: z.string().nullable().optional(),
  metadata: fileMetadataSchema.nullable().optional(),
  created_at: z.number(),
})

const itemFileSchema = z.object({
  id: z.string(),
  item_id: z.string(),
  field_id: z.string().nullable().optional(),
  file_hash: fileHashSchema,
  sort_order: z.number().nullable().optional(),
  metadata: fileMetadataSchema.nullable().optional(),
  created_at: z.number(),
})

const itemFileWithFileSchema = itemFileSchema.extend({
  file: fileSchema,
})

const fileThumbnailSchema = z.object({
  id: z.string(),
  file_hash: fileHashSchema,
  size_name: thumbnailSizeSchema,
  width: z.number(),
  height: z.number(),
  format: z.string().nullable().optional(),
  storage_path: z.string(),
  created_at: z.number(),
})

export const dataModule = createEdemModule("data", (module) => {
  return (
    module
      .context(async (config) => {
        const dbPath = config.appData ? join(config.appData, "data.db") : ":memory:"
        const storageRoot = config.appData ?? (await mkdtemp(join(tmpdir(), "edem-data-")))
        const engine = createDataEngine({ dbPath })
        const filesDir = join(storageRoot, "files")
        const thumbnailsDir = join(storageRoot, "thumbnails")
        const uploadsDir = join(storageRoot, "uploads")
        const storage = createFileStorage({ baseDir: filesDir })
        const fileUploads = new Map<string, FileUploadSession>()

        return { db: engine.db, engine, storage, thumbnailsDir, uploadsDir, fileUploads }
      })
      // ── Subscriptions ──────────────────────────────────────────────────────
      .subscription("collectionCreated", { output: collectionSchema })
      .subscription("collectionUpdated", { output: collectionSchema })
      .subscription("collectionDeleted", { output: z.object({ collection_id: z.string() }) })
      .subscription("itemCreated", { output: itemSchema })
      .subscription("itemUpdated", { output: itemSchema })
      .subscription("itemDeleted", {
        output: z.object({ item_id: z.string(), collection_id: z.string() }),
      })
      .subscription("relationAdded", { output: relationSchema })
      .subscription("relationRemoved", { output: z.object({ relation_id: z.string() }) })
      .subscription("itemLocked", { output: itemLockSchema })
      .subscription("itemUnlocked", { output: z.object({ item_id: z.string() }) })
      .subscription("versionRestored", { output: itemVersionSchema })
      // ── Collections ───────────────────────────────────────────────────────
      .mutation("createCollection", {
        input: z.object({
          id: z.string(),
          name: z.string(),
          labels: labelsSchema.optional(),
          parent_id: z.string().optional(),
          description: z.string().optional(),
          icon: z.string().optional(),
          singleton: z.boolean().optional(),
          fields: z.array(fieldInputSchema).optional(),
          meta: z.record(z.string(), z.any()).optional(),
        }),
        output: z.object({ id: z.string() }),
        resolve: async ({ input, ctx, emit }) => {
          const now = Date.now()

          await ctx.db.insert(schema.collections).values({
            id: input.id,
            parent_id: input.parent_id,
            name: input.name,
            labels: input.labels ? JSON.stringify(input.labels) : null,
            description: input.description,
            icon: input.icon,
            singleton: input.singleton,
            meta: input.meta ? JSON.stringify(input.meta) : null,
            created_at: now,
            updated_at: now,
          })

          if (input.fields) {
            for (const field of input.fields) {
              await ctx.db.insert(schema.fields).values({
                id: crypto.randomUUID(),
                collection_id: input.id,
                name: field.name,
                labels: field.labels ? JSON.stringify(field.labels) : null,
                type: field.type,
                required: field.required,
                hidden: field.hidden ?? false,
                readonly: field.readonly ?? false,
                system: field.system ?? false,
                special: field.special ?? null,
                default_value: serializeFieldDefaultValue(field.default),
                interface_options: serializeFieldOptions(field.type, field.options, field.relation),
                meta: field.meta ? JSON.stringify(field.meta) : null,
              })
            }
          }

          const collection = await getCollectionWithFields(ctx.db, input.id)
          if (!collection) throw new Error(`Collection ${input.id} not found after creation`)
          await emit.collectionCreated(collection)
          return { id: input.id }
        },
      })
      .mutation("updateCollection", {
        input: z.object({
          collection_id: z.string(),
          name: z.string().optional(),
          labels: labelsSchema.optional(),
          description: z.string().optional(),
          icon: z.string().optional(),
          singleton: z.boolean().optional(),
          fields: z.array(fieldInputSchema).optional(),
          default_sort_field: z.string().optional(),
          default_sort_dir: z.enum(["asc", "desc"]).optional(),
          meta: z.record(z.string(), z.any()).optional(),
        }),
        output: z.object({ id: z.string() }),
        resolve: async ({ input, ctx, emit }) => {
          const { collection_id, fields: newFields, meta, labels, ...updates } = input
          const now = Date.now()

          const existing = await ctx.db.query.collections.findFirst({
            where: eq(schema.collections.id, collection_id),
          })
          if (!existing) {
            throw new Error(`Collection ${collection_id} not found`)
          }

          const updateData: Record<string, unknown> = { ...updates, updated_at: now }
          if (meta !== undefined) updateData.meta = JSON.stringify(meta)
          if (labels !== undefined) updateData.labels = JSON.stringify(labels)

          await ctx.db.transaction(async (tx) => {
            await tx
              .update(schema.collections)
              .set(updateData)
              .where(eq(schema.collections.id, collection_id))

            if (newFields) {
              await tx.delete(schema.fields).where(eq(schema.fields.collection_id, collection_id))
              for (const field of newFields) {
                await tx.insert(schema.fields).values({
                  id: crypto.randomUUID(),
                  collection_id,
                  name: field.name,
                  labels: field.labels ? JSON.stringify(field.labels) : null,
                  type: field.type,
                  required: field.required,
                  hidden: field.hidden ?? false,
                  readonly: field.readonly ?? false,
                  system: field.system ?? false,
                  special: field.special ?? null,
                  default_value: serializeFieldDefaultValue(field.default),
                  interface_options: serializeFieldOptions(
                    field.type,
                    field.options,
                    field.relation,
                  ),
                  meta: field.meta ? JSON.stringify(field.meta) : null,
                })
              }
            }
          })

          const collection = await getCollectionWithFields(ctx.db, collection_id)
          if (!collection) throw new Error(`Collection ${collection_id} not found after update`)
          await emit.collectionUpdated(collection)
          return { id: collection_id }
        },
      })
      .mutation("deleteCollection", {
        input: z.object({ collection_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx, emit }) => {
          const collection = await ctx.db.query.collections.findFirst({
            where: eq(schema.collections.id, input.collection_id),
          })
          if (!collection) {
            throw new Error(`Collection ${input.collection_id} not found`)
          }

          await ctx.db
            .update(schema.collections)
            .set({ deleted_at: Date.now() })
            .where(eq(schema.collections.id, input.collection_id))
          await emit.collectionDeleted({ collection_id: input.collection_id })
          return { success: true }
        },
      })
      .mutation("restoreCollection", {
        input: z.object({ collection_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          const collection = await ctx.db.query.collections.findFirst({
            where: eq(schema.collections.id, input.collection_id),
          })
          if (!collection) throw new Error(`Collection ${input.collection_id} not found`)

          await ctx.db
            .update(schema.collections)
            .set({ deleted_at: null })
            .where(eq(schema.collections.id, input.collection_id))
          return { success: true }
        },
      })
      .mutation("emptyCollectionTrash", {
        input: z.void(),
        output: z.object({ deleted: z.number() }),
        resolve: async ({ ctx }) => {
          const deleted = await ctx.db.query.collections.findMany({
            where: isNotNull(schema.collections.deleted_at),
          })
          if (deleted.length === 0) return { deleted: 0 }

          for (const row of deleted) {
            await ctx.db.delete(schema.collections).where(eq(schema.collections.id, row.id))
          }
          return { deleted: deleted.length }
        },
      })
      .query("getDeletedCollections", {
        input: z.void(),
        output: z.object({ collections: z.array(collectionSchema) }),
        resolve: async ({ ctx }) => {
          const rows = await ctx.db.query.collections.findMany({
            where: isNotNull(schema.collections.deleted_at),
          })

          const collections = await Promise.all(
            rows.map(async (row) => {
              const fields = await ctx.db.query.fields.findMany({
                where: eq(schema.fields.collection_id, row.id),
              })
              return {
                ...row,
                labels: row.labels
                  ? safeJsonParse<Record<string, string>>(row.labels, `collection ${row.id} labels`)
                  : undefined,
                meta: row.meta
                  ? safeJsonParse<Record<string, unknown>>(row.meta, `collection ${row.id} meta`)
                  : undefined,
                fields: fields.map(parseStoredField),
              }
            }),
          )
          return { collections }
        },
      })
      .query("getCollection", {
        input: z.object({ collection_id: z.string() }),
        output: z.object({ collection: collectionSchema.nullable() }),
        resolve: async ({ input, ctx }) => {
          const collection = await getCollectionWithFields(ctx.db, input.collection_id)
          return { collection: collection ?? null }
        },
      })
      .query("listCollections", {
        input: z.object({
          parent_id: z.string().optional(),
        }),
        output: z.object({ collections: z.array(collectionSchema) }),
        resolve: async ({ input, ctx }) => {
          const conditions = [isNull(schema.collections.deleted_at)]
          if (input.parent_id) {
            conditions.push(eq(schema.collections.parent_id, input.parent_id))
          }

          const rows = await ctx.db.query.collections.findMany({
            where: and(...conditions),
            orderBy: asc(schema.collections.name),
          })

          const collections = await Promise.all(
            rows.map((row) => getCollectionWithFields(ctx.db, row.id)),
          )
          return { collections: collections.filter(Boolean) as z.infer<typeof collectionSchema>[] }
        },
      })
      // ── Fields ──────────────────────────────────────────────────────────────
      .mutation("createField", {
        input: z.object({
          collection_id: z.string(),
          name: z.string(),
          labels: labelsSchema.optional(),
          type: z.enum(fieldTypes),
          relation: relationFieldSchema.optional(),
          options: z.record(z.string(), z.any()).optional(),
          interface: z.string().optional(),
          display: z.string().optional(),
          required: z.boolean().optional(),
          hidden: z.boolean().optional(),
          readonly: z.boolean().optional(),
          system: z.boolean().optional(),
          special: z.enum(fieldSpecials).optional(),
          default_value: z.any().optional(),
          validation: z.record(z.string(), z.any()).optional(),
          meta: z.record(z.string(), z.any()).optional(),
        }),
        output: z.object({ id: z.string() }),
        resolve: async ({ input, ctx }) => {
          const collection = await ctx.db.query.collections.findFirst({
            where: eq(schema.collections.id, input.collection_id),
          })
          if (!collection) throw new Error(`Collection ${input.collection_id} not found`)

          const serializedOptions = serializeFieldOptions(input.type, input.options, input.relation)
          if (input.type === "relation" && !serializedOptions) {
            throw new Error("Relation field must define a target collection")
          }

          const id = crypto.randomUUID()
          await ctx.db.insert(schema.fields).values({
            id,
            collection_id: input.collection_id,
            name: input.name,
            labels: input.labels ? JSON.stringify(input.labels) : null,
            type: input.type,
            interface: input.interface,
            display: input.display,
            interface_options: serializedOptions,
            required: input.required ?? false,
            hidden: input.hidden ?? false,
            readonly: input.readonly ?? false,
            system: input.system ?? false,
            special: input.special ?? null,
            default_value:
              input.default_value !== undefined ? JSON.stringify(input.default_value) : null,
            validation: input.validation ? JSON.stringify(input.validation) : null,
            meta: input.meta ? JSON.stringify(input.meta) : null,
          })

          await ctx.db
            .update(schema.collections)
            .set({ updated_at: Date.now() })
            .where(eq(schema.collections.id, input.collection_id))

          return { id }
        },
      })
      .mutation("updateField", {
        input: z.object({
          field_id: z.string(),
          name: z.string().optional(),
          labels: labelsSchema.optional(),
          type: z.enum(fieldTypes).optional(),
          relation: relationFieldSchema.optional(),
          options: z.record(z.string(), z.any()).optional(),
          interface: z.string().optional(),
          display: z.string().optional(),
          required: z.boolean().optional(),
          hidden: z.boolean().optional(),
          readonly: z.boolean().optional(),
          system: z.boolean().optional(),
          special: z.enum(fieldSpecials).optional(),
          default_value: z.any().optional(),
          validation: z.record(z.string(), z.any()).optional(),
          meta: z.record(z.string(), z.any()).optional(),
        }),
        output: z.object({ id: z.string() }),
        resolve: async ({ input, ctx }) => {
          const {
            field_id,
            default_value,
            validation,
            meta,
            labels,
            relation,
            options,
            ...updates
          } = input

          const field = await ctx.db.query.fields.findFirst({
            where: eq(schema.fields.id, field_id),
          })
          if (!field) throw new Error(`Field ${field_id} not found`)

          const existingOptions = parseFieldOptions(
            field.interface_options,
            `field ${field.id} options`,
          )
          const { options: currentOptions, relation: currentRelation } = splitFieldOptions(
            field.type as FieldType,
            existingOptions,
          )
          const nextType = (updates.type as FieldType | undefined) ?? (field.type as FieldType)
          const nextOptions = options ?? currentOptions
          const nextRelation = relation ?? currentRelation
          const serializedOptions = serializeFieldOptions(nextType, nextOptions, nextRelation)

          if (nextType === "relation" && !serializedOptions) {
            throw new Error("Relation field must define a target collection")
          }

          const updateData: Record<string, unknown> = { ...updates }
          if (default_value !== undefined) updateData.default_value = JSON.stringify(default_value)
          if (validation !== undefined) updateData.validation = JSON.stringify(validation)
          if (meta !== undefined) updateData.meta = JSON.stringify(meta)
          if (labels !== undefined) updateData.labels = JSON.stringify(labels)
          if (relation !== undefined || options !== undefined || updates.type !== undefined) {
            updateData.interface_options = serializedOptions
          }

          await ctx.db.update(schema.fields).set(updateData).where(eq(schema.fields.id, field_id))

          await ctx.db
            .update(schema.collections)
            .set({ updated_at: Date.now() })
            .where(eq(schema.collections.id, field.collection_id))

          return { id: field_id }
        },
      })
      .mutation("deleteField", {
        input: z.object({ field_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          const field = await ctx.db.query.fields.findFirst({
            where: eq(schema.fields.id, input.field_id),
          })
          if (!field) throw new Error(`Field ${input.field_id} not found`)

          await ctx.db.delete(schema.fields).where(eq(schema.fields.id, input.field_id))

          await ctx.db
            .update(schema.collections)
            .set({ updated_at: Date.now() })
            .where(eq(schema.collections.id, field.collection_id))

          return { success: true }
        },
      })
      .mutation("reorderFields", {
        input: z.object({ field_ids: z.array(z.string()) }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          for (let i = 0; i < input.field_ids.length; i++) {
            await ctx.db
              .update(schema.fields)
              .set({ group_name: String(i) })
              .where(eq(schema.fields.id, input.field_ids[i]))
          }
          return { success: true }
        },
      })
      .query("getFields", {
        input: z.object({ collection_id: z.string() }),
        output: z.object({ fields: z.array(fieldSchema) }),
        resolve: async ({ input, ctx }) => {
          const fields = await ctx.db.query.fields.findMany({
            where: eq(schema.fields.collection_id, input.collection_id),
          })
          return {
            fields: fields.map(parseStoredField),
          }
        },
      })
      .query("getField", {
        input: z.object({ field_id: z.string() }),
        output: z.object({ field: fieldSchema.nullable() }),
        resolve: async ({ input, ctx }) => {
          const f = await ctx.db.query.fields.findFirst({
            where: eq(schema.fields.id, input.field_id),
          })
          if (!f) return { field: null }
          return {
            field: parseStoredField(f),
          }
        },
      })
      // ── Items ─────────────────────────────────────────────────────────────
      .mutation("createItem", {
        input: z.object({
          collection_id: z.string(),
          data: z.record(z.string(), z.any()),
          source: z.string().optional(),
        }),
        output: z.object({ id: z.string() }),
        resolve: async ({ input, ctx, emit }) => {
          const collection = await ctx.db.query.collections.findFirst({
            where: eq(schema.collections.id, input.collection_id),
          })
          if (!collection) {
            throw new Error(`Collection ${input.collection_id} not found`)
          }

          if (collection.singleton) {
            const existing = await ctx.db.query.items.findFirst({
              where: eq(schema.items.collection_id, input.collection_id),
            })
            if (existing) {
              throw new Error(
                `Cannot create item in singleton collection "${input.collection_id}". Use updateSingleton instead.`,
              )
            }
          }

          const fields = await ctx.db.query.fields.findMany({
            where: eq(schema.fields.collection_id, input.collection_id),
          })

          const id = crypto.randomUUID()
          const now = Date.now()
          const data = applyGeneratedFieldValues(input.data, fields, { itemId: id, now })

          validateItemData(fields, data)

          await ctx.db.insert(schema.items).values({
            id,
            collection_id: input.collection_id,
            schema_version: collection.schema_version ?? 1,
            source: input.source,
            data: JSON.stringify(data),
            created_at: now,
            updated_at: now,
          })

          const item = await ctx.db.query.items.findFirst({
            where: eq(schema.items.id, id),
          })
          if (!item) throw new Error(`Item ${id} not found after creation`)
          await emit.itemCreated(parseItem(item))
          return { id }
        },
      })
      .mutation("updateItem", {
        input: z.object({
          item_id: z.string(),
          data: z.record(z.string(), z.any()),
          source: z.string().optional(),
          create_version: z.boolean().optional(),
        }),
        output: z.object({ id: z.string() }),
        resolve: async ({ input, ctx, emit }) => {
          const item = await ctx.db.query.items.findFirst({
            where: eq(schema.items.id, input.item_id),
          })
          if (!item) {
            throw new Error(`Item ${input.item_id} not found`)
          }

          const currentData = safeJsonParse<Record<string, unknown>>(
            item.data,
            `item ${input.item_id}`,
          )
          const mergedInputData = { ...currentData, ...input.data }

          const fields = await ctx.db.query.fields.findMany({
            where: eq(schema.fields.collection_id, item.collection_id),
          })

          const now = Date.now()
          const mergedData = applyGeneratedFieldValues(mergedInputData, fields, {
            itemId: input.item_id,
            now,
            createdAt: item.created_at,
            currentData,
          })

          validateItemData(fields, mergedData, {
            validateFieldNames: buildUpdatedFieldValidationNames(input.data, fields),
          })

          if (input.create_version !== false) {
            const versions = await ctx.db.query.itemVersions.findMany({
              where: eq(schema.itemVersions.item_id, input.item_id),
              orderBy: desc(schema.itemVersions.version),
            })
            const nextVersion = versions.length > 0 ? versions[0].version + 1 : 1

            await ctx.db.insert(schema.itemVersions).values({
              id: crypto.randomUUID(),
              item_id: input.item_id,
              version: nextVersion,
              data: item.data,
              source: input.source,
              created_at: now,
            })
          }

          await ctx.db
            .update(schema.items)
            .set({
              data: JSON.stringify(mergedData),
              source: input.source,
              updated_at: now,
            })
            .where(eq(schema.items.id, input.item_id))

          const updated = await ctx.db.query.items.findFirst({
            where: eq(schema.items.id, input.item_id),
          })
          if (!updated) throw new Error(`Item ${input.item_id} not found after update`)
          await emit.itemUpdated(parseItem(updated))
          return { id: input.item_id }
        },
      })
      .mutation("deleteItem", {
        input: z.object({ item_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx, emit }) => {
          const item = await ctx.db.query.items.findFirst({
            where: eq(schema.items.id, input.item_id),
          })
          if (!item) {
            throw new Error(`Item ${input.item_id} not found`)
          }

          await ctx.db
            .update(schema.items)
            .set({ deleted_at: Date.now() })
            .where(eq(schema.items.id, input.item_id))
          await emit.itemDeleted({ item_id: input.item_id, collection_id: item.collection_id })
          return { success: true }
        },
      })
      .mutation("restoreItem", {
        input: z.object({ item_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          const item = await ctx.db.query.items.findFirst({
            where: eq(schema.items.id, input.item_id),
          })
          if (!item) throw new Error(`Item ${input.item_id} not found`)

          await ctx.db
            .update(schema.items)
            .set({ deleted_at: null })
            .where(eq(schema.items.id, input.item_id))
          return { success: true }
        },
      })
      .mutation("deleteItems", {
        input: z.object({ item_ids: z.array(z.string()) }),
        output: z.object({ deleted: z.number() }),
        resolve: async ({ input, ctx }) => {
          let deleted = 0
          for (const item_id of input.item_ids) {
            const item = await ctx.db.query.items.findFirst({
              where: eq(schema.items.id, item_id),
            })
            if (item) {
              await ctx.db
                .update(schema.items)
                .set({ deleted_at: Date.now() })
                .where(eq(schema.items.id, item_id))
              deleted++
            }
          }
          return { deleted }
        },
      })
      .mutation("updateItems", {
        input: z.object({
          item_ids: z.array(z.string()),
          data: z.record(z.string(), z.any()),
          source: z.string().optional(),
        }),
        output: z.object({ updated: z.number() }),
        resolve: async ({ input, ctx }) => {
          let updated = 0
          const now = Date.now()
          for (const item_id of input.item_ids) {
            const item = await ctx.db.query.items.findFirst({
              where: eq(schema.items.id, item_id),
            })
            if (!item) continue

            const currentData = safeJsonParse<Record<string, unknown>>(item.data, `item ${item_id}`)
            const fields = await ctx.db.query.fields.findMany({
              where: eq(schema.fields.collection_id, item.collection_id),
            })
            const mergedData = applyGeneratedFieldValues(
              { ...currentData, ...input.data },
              fields,
              {
                itemId: item_id,
                now,
                createdAt: item.created_at,
                currentData,
              },
            )

            await ctx.db
              .update(schema.items)
              .set({
                data: JSON.stringify(mergedData),
                source: input.source,
                updated_at: now,
              })
              .where(eq(schema.items.id, item_id))
            updated++
          }
          return { updated }
        },
      })
      .mutation("updateItemsBatch", {
        input: z.object({
          updates: z.array(z.object({ item_id: z.string(), data: z.record(z.string(), z.any()) })),
          source: z.string().optional(),
        }),
        output: z.object({ updated: z.number() }),
        resolve: async ({ input, ctx }) => {
          let updated = 0
          const now = Date.now()
          for (const { item_id, data } of input.updates) {
            const item = await ctx.db.query.items.findFirst({
              where: eq(schema.items.id, item_id),
            })
            if (!item) continue

            const currentData = safeJsonParse<Record<string, unknown>>(item.data, `item ${item_id}`)
            const fields = await ctx.db.query.fields.findMany({
              where: eq(schema.fields.collection_id, item.collection_id),
            })
            const mergedData = applyGeneratedFieldValues({ ...currentData, ...data }, fields, {
              itemId: item_id,
              now,
              createdAt: item.created_at,
              currentData,
            })

            await ctx.db
              .update(schema.items)
              .set({
                data: JSON.stringify(mergedData),
                source: input.source,
                updated_at: now,
              })
              .where(eq(schema.items.id, item_id))
            updated++
          }
          return { updated }
        },
      })
      .mutation("deleteItemsByFilter", {
        input: z.object({
          collection_id: z.string(),
          filter: filterSchema,
        }),
        output: z.object({ deleted: z.number() }),
        resolve: async ({ input, ctx }) => {
          const rows = await ctx.db.query.items.findMany({
            where: and(
              eq(schema.items.collection_id, input.collection_id),
              isNull(schema.items.deleted_at),
            ),
          })

          const items = rows.map(parseItem)
          const filtered = input.filter
            ? items.filter((item) =>
                matchFilter(item.data, input.filter as Record<string, unknown>),
              )
            : items

          let deleted = 0
          const now = Date.now()
          for (const item of filtered) {
            await ctx.db
              .update(schema.items)
              .set({ deleted_at: now })
              .where(eq(schema.items.id, item.id))
            deleted++
          }
          return { deleted }
        },
      })
      .query("countItems", {
        input: z.object({
          collection_id: z.string(),
          filter: filterSchema,
          locale: z.string().optional(),
        }),
        output: z.object({ count: z.number() }),
        resolve: async ({ input, ctx }) => {
          const rows = await ctx.db.query.items.findMany({
            where: and(
              eq(schema.items.collection_id, input.collection_id),
              isNull(schema.items.deleted_at),
            ),
          })

          let items = rows.map(parseItem)
          if (input.filter) {
            const localeOpts = input.locale ? { locale: input.locale, fallback: "en" } : undefined
            items = items.filter((item) =>
              matchFilter(item.data, input.filter as Record<string, unknown>, localeOpts),
            )
          }
          return { count: items.length }
        },
      })
      .query("getDeletedItems", {
        input: z.object({ collection_id: z.string() }),
        output: z.object({ items: z.array(itemSchema) }),
        resolve: async ({ input, ctx }) => {
          const rows = await ctx.db.query.items.findMany({
            where: and(
              eq(schema.items.collection_id, input.collection_id),
              isNotNull(schema.items.deleted_at),
            ),
          })
          return { items: rows.map(parseItem) }
        },
      })
      .mutation("emptyItemsTrash", {
        input: z.object({ collection_id: z.string() }),
        output: z.object({ deleted: z.number() }),
        resolve: async ({ input, ctx }) => {
          const rows = await ctx.db.query.items.findMany({
            where: and(
              eq(schema.items.collection_id, input.collection_id),
              isNotNull(schema.items.deleted_at),
            ),
          })

          let deleted = 0
          for (const row of rows) {
            await ctx.db.delete(schema.items).where(eq(schema.items.id, row.id))
            deleted++
          }
          return { deleted }
        },
      })
      .query("getItem", {
        input: z.object({
          item_id: z.string(),
          locale: z.string().optional(),
        }),
        output: z.object({ item: itemSchema.nullable() }),
        resolve: async ({ input, ctx }) => {
          const item = await ctx.db.query.items.findFirst({
            where: and(eq(schema.items.id, input.item_id), isNull(schema.items.deleted_at)),
          })
          if (!item) return { item: null }
          const parsed = parseItem(item)
          if (input.locale) {
            const collectionFieldTypes = await getCollectionFieldTypes(ctx.db, parsed.collection_id)
            parsed.data = resolveLocalizedData(parsed.data, collectionFieldTypes, input.locale)
          }
          return { item: parsed }
        },
      })
      .query("queryItems", {
        input: z.object({
          collection_id: z.string(),
          filter: filterSchema.optional(),
          sort: sortSchema.optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
          locale: z.string().optional(),
        }),
        output: z.object({
          items: z.array(itemSchema),
          total: z.number(),
        }),
        resolve: async ({ input, ctx }) => {
          const conditions = [
            eq(schema.items.collection_id, input.collection_id),
            isNull(schema.items.deleted_at),
          ]

          const rows = await ctx.db.query.items.findMany({
            where: and(...conditions),
          })

          let items = rows.map(parseItem)
          const localeOpts = input.locale ? { locale: input.locale, fallback: "en" } : undefined

          if (input.filter) {
            items = items.filter((item) =>
              matchFilter(item.data, input.filter as Record<string, unknown>, localeOpts),
            )
          }

          const total = items.length

          if (input.sort) {
            items = sortItems(items, input.sort, localeOpts)
          }

          if (input.offset !== undefined) {
            items = items.slice(input.offset)
          }
          if (input.limit !== undefined) {
            items = items.slice(0, input.limit)
          }

          if (input.locale) {
            const collectionFieldTypes = await getCollectionFieldTypes(ctx.db, input.collection_id)
            items = items.map((item) => ({
              ...item,
              data: resolveLocalizedData(item.data, collectionFieldTypes, input.locale!),
            }))
          }

          return { items, total }
        },
      })
      .query("searchItems", {
        input: z.object({
          collection_id: z.string(),
          query: z.string(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        }),
        output: z.object({
          items: z.array(itemSchema),
          total: z.number(),
        }),
        resolve: async ({ input, ctx }) => {
          const rows = await ctx.db.query.items.findMany({
            where: and(
              eq(schema.items.collection_id, input.collection_id),
              isNull(schema.items.deleted_at),
            ),
          })

          let items = rows.map(parseItem)
          items = items.filter((item) => matchFilter(item.data, { _search: input.query }))

          const total = items.length

          if (input.offset !== undefined) {
            items = items.slice(input.offset)
          }
          if (input.limit !== undefined) {
            items = items.slice(0, input.limit)
          }

          return { items, total }
        },
      })
      .query("countSearchResults", {
        input: z.object({
          collection_id: z.string(),
          query: z.string(),
        }),
        output: z.object({ count: z.number() }),
        resolve: async ({ input, ctx }) => {
          const rows = await ctx.db.query.items.findMany({
            where: and(
              eq(schema.items.collection_id, input.collection_id),
              isNull(schema.items.deleted_at),
            ),
          })

          const items = rows.filter((row) =>
            matchFilter(parseItem(row).data, { _search: input.query }),
          )
          return { count: items.length }
        },
      })
      // ── Relations ─────────────────────────────────────────────────────────
      .mutation("addRelation", {
        input: z.object({
          source_item_id: z.string(),
          source_field_id: z.string(),
          target_item_id: z.string(),
          target_collection_id: z.string(),
        }),
        output: z.object({ relation: relationSchema }),
        resolve: async ({ input, ctx, emit }) => {
          const id = crypto.randomUUID()
          const now = Date.now()

          await ctx.db.insert(schema.relations).values({
            id,
            ...input,
            created_at: now,
          })

          const relation = await ctx.db.query.relations.findFirst({
            where: eq(schema.relations.id, id),
          })
          if (!relation) throw new Error(`Relation ${id} not found after creation`)
          await emit.relationAdded(relation)
          return { relation }
        },
      })
      .mutation("removeRelation", {
        input: z.object({ relation_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx, emit }) => {
          await ctx.db.delete(schema.relations).where(eq(schema.relations.id, input.relation_id))
          await emit.relationRemoved({ relation_id: input.relation_id })
          return { success: true }
        },
      })
      .query("getItemRelations", {
        input: z.object({ item_id: z.string(), field_id: z.string() }),
        output: z.object({ relations: z.array(relationSchema) }),
        resolve: async ({ input, ctx }) => {
          const relations = await ctx.db.query.relations.findMany({
            where: and(
              eq(schema.relations.source_item_id, input.item_id),
              eq(schema.relations.source_field_id, input.field_id),
            ),
            orderBy: asc(schema.relations.sort_order),
          })
          return { relations }
        },
      })
      .mutation("reorderRelations", {
        input: z.object({ relation_ids: z.array(z.string()) }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          for (let i = 0; i < input.relation_ids.length; i++) {
            await ctx.db
              .update(schema.relations)
              .set({ sort_order: i })
              .where(eq(schema.relations.id, input.relation_ids[i]))
          }
          return { success: true }
        },
      })
      .query("getAllItemRelations", {
        input: z.object({ item_id: z.string() }),
        output: z.object({ relations: z.array(relationSchema) }),
        resolve: async ({ input, ctx }) => {
          const relations = await ctx.db.query.relations.findMany({
            where: eq(schema.relations.source_item_id, input.item_id),
            orderBy: asc(schema.relations.sort_order),
          })
          return { relations }
        },
      })
      .query("getReverseRelations", {
        input: z.object({ item_id: z.string() }),
        output: z.object({ relations: z.array(relationSchema) }),
        resolve: async ({ input, ctx }) => {
          const relations = await ctx.db.query.relations.findMany({
            where: eq(schema.relations.target_item_id, input.item_id),
            orderBy: asc(schema.relations.sort_order),
          })
          return { relations }
        },
      })
      // ── Locks ─────────────────────────────────────────────────────────────
      .mutation("lockItem", {
        input: z.object({
          item_id: z.string(),
          locked_by: z.string(),
          reason: z.string().optional(),
          ttl_seconds: z.number().optional(),
        }),
        output: z.object({ lock: itemLockSchema }),
        resolve: async ({ input, ctx, emit }) => {
          const existing = await ctx.db.query.itemLocks.findFirst({
            where: eq(schema.itemLocks.item_id, input.item_id),
          })
          if (existing && existing.expires_at > Date.now()) {
            throw new Error(`Item ${input.item_id} is already locked by ${existing.locked_by}`)
          }

          const id = crypto.randomUUID()
          const now = Date.now()
          const ttl = input.ttl_seconds ?? 300
          const expiresAt = now + ttl * 1000

          if (existing) {
            await ctx.db
              .update(schema.itemLocks)
              .set({
                locked_by: input.locked_by,
                reason: input.reason,
                expires_at: expiresAt,
                created_at: now,
              })
              .where(eq(schema.itemLocks.item_id, input.item_id))
          } else {
            await ctx.db.insert(schema.itemLocks).values({
              id,
              item_id: input.item_id,
              locked_by: input.locked_by,
              reason: input.reason,
              expires_at: expiresAt,
              created_at: now,
            })
          }

          const lock = await ctx.db.query.itemLocks.findFirst({
            where: eq(schema.itemLocks.item_id, input.item_id),
          })
          if (!lock) throw new Error(`Lock for item ${input.item_id} not found after creation`)
          await emit.itemLocked(lock)
          return { lock }
        },
      })
      .mutation("unlockItem", {
        input: z.object({ item_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx, emit }) => {
          await ctx.db.delete(schema.itemLocks).where(eq(schema.itemLocks.item_id, input.item_id))
          await emit.itemUnlocked({ item_id: input.item_id })
          return { success: true }
        },
      })
      .mutation("forceUnlockItem", {
        input: z.object({ item_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          await ctx.db.delete(schema.itemLocks).where(eq(schema.itemLocks.item_id, input.item_id))
          return { success: true }
        },
      })
      .mutation("extendLock", {
        input: z.object({
          item_id: z.string(),
          ttl_seconds: z.number().optional(),
        }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          const lock = await ctx.db.query.itemLocks.findFirst({
            where: eq(schema.itemLocks.item_id, input.item_id),
          })
          if (!lock) throw new Error(`No lock found for item ${input.item_id}`)

          const ttl = input.ttl_seconds ?? 300
          const newExpiry = Date.now() + ttl * 1000

          await ctx.db
            .update(schema.itemLocks)
            .set({ expires_at: newExpiry })
            .where(eq(schema.itemLocks.item_id, input.item_id))

          return { success: true }
        },
      })
      .query("isItemLocked", {
        input: z.object({ item_id: z.string() }),
        output: z.object({ locked: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          const lock = await ctx.db.query.itemLocks.findFirst({
            where: eq(schema.itemLocks.item_id, input.item_id),
          })
          if (!lock) return { locked: false }
          if (lock.expires_at < Date.now()) {
            await ctx.db.delete(schema.itemLocks).where(eq(schema.itemLocks.id, lock.id))
            return { locked: false }
          }
          return { locked: true }
        },
      })
      .query("getItemLock", {
        input: z.object({ item_id: z.string() }),
        output: z.object({ lock: itemLockSchema.nullable() }),
        resolve: async ({ input, ctx }) => {
          const lock = await ctx.db.query.itemLocks.findFirst({
            where: eq(schema.itemLocks.item_id, input.item_id),
          })
          if (lock && lock.expires_at < Date.now()) {
            await ctx.db.delete(schema.itemLocks).where(eq(schema.itemLocks.id, lock.id))
            return { lock: null }
          }
          return { lock: lock ?? null }
        },
      })
      // ── Files ──────────────────────────────────────────────────────────────
      .mutation("beginFileUpload", {
        input: z.object({
          name: z.string().optional(),
          mime_type: z.string().optional(),
          size: z.number().int().nonnegative().optional(),
        }),
        output: z.object({ upload_id: uploadIdSchema, chunk_size: z.number() }),
        resolve: async ({ input, ctx }) => {
          const uploadId = crypto.randomUUID()
          const uploadPath = join(ctx.uploadsDir, uploadId)

          await ensureParentDir(uploadPath)
          await Bun.write(uploadPath, new Uint8Array())

          ctx.fileUploads.set(uploadId, {
            id: uploadId,
            path: uploadPath,
            originalName: input.name?.trim() || uploadId,
            mimeType: input.mime_type?.trim() || "application/octet-stream",
            size: input.size,
            uploadedBytes: 0,
            createdAt: Date.now(),
          })

          return { upload_id: uploadId, chunk_size: recommendedFileChunkBytes }
        },
      })
      .mutation("writeFileUploadChunk", {
        input: z.object({
          upload_id: uploadIdSchema,
          offset: z.number().int().nonnegative(),
          data_base64: z.string(),
        }),
        output: z.object({ uploaded: z.number(), done: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          const session = ctx.fileUploads.get(input.upload_id)
          if (!session) {
            throw new Error(`File upload ${input.upload_id} not found`)
          }
          if (input.offset !== session.uploadedBytes) {
            throw new Error(
              `File upload ${input.upload_id} expected offset ${session.uploadedBytes}, got ${input.offset}`,
            )
          }

          const chunk = decodeBase64Chunk(input.data_base64)
          if (chunk.byteLength > maxFileChunkBytes) {
            throw new Error(`File upload chunk exceeds ${maxFileChunkBytes} bytes`)
          }
          if (
            session.size !== undefined &&
            session.uploadedBytes + chunk.byteLength > session.size
          ) {
            throw new Error(`File upload ${input.upload_id} exceeds declared size ${session.size}`)
          }

          await writeUploadChunk(session.path, input.offset, chunk)
          session.uploadedBytes += chunk.byteLength

          return {
            uploaded: session.uploadedBytes,
            done: session.size !== undefined && session.uploadedBytes >= session.size,
          }
        },
      })
      .mutation("completeFileUpload", {
        input: z.object({
          upload_id: uploadIdSchema,
          expected_hash: fileHashSchema.optional(),
        }),
        output: z.object({ file: fileSchema }),
        resolve: async ({ input, ctx }) => {
          const session = ctx.fileUploads.get(input.upload_id)
          if (!session) {
            throw new Error(`File upload ${input.upload_id} not found`)
          }
          if (session.size !== undefined && session.uploadedBytes !== session.size) {
            throw new Error(
              `File upload ${input.upload_id} is incomplete: ${session.uploadedBytes}/${session.size} bytes`,
            )
          }

          const tempFile = Bun.file(session.path)
          if (!(await tempFile.exists())) {
            throw new Error(`File upload ${input.upload_id} temp file is missing`)
          }
          if (tempFile.size !== session.uploadedBytes) {
            throw new Error(
              `File upload ${input.upload_id} size mismatch: ${tempFile.size}/${session.uploadedBytes} bytes`,
            )
          }

          const stored = await ctx.storage.putFile(session.path)
          if (input.expected_hash && stored.hash !== input.expected_hash) {
            throw new Error(
              `File upload ${input.upload_id} hash mismatch: expected ${input.expected_hash}, got ${stored.hash}`,
            )
          }

          const file = await ensureStoredFileRecord(ctx.db, {
            stored,
            originalName: session.originalName,
            mimeType: session.mimeType,
          })

          ctx.fileUploads.delete(input.upload_id)
          await removeFilePath(session.path)

          return { file }
        },
      })
      .mutation("abortFileUpload", {
        input: z.object({ upload_id: uploadIdSchema }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          const session = ctx.fileUploads.get(input.upload_id)
          if (!session) return { success: false }

          ctx.fileUploads.delete(input.upload_id)
          await removeFilePath(session.path)

          return { success: true }
        },
      })
      .mutation("storeFile", {
        input: z.object({
          file_path: z.string(),
          name: z.string().optional(),
        }),
        output: z.object({ hash: fileHashSchema, size: z.number(), path: z.string() }),
        resolve: async ({ input, ctx }) => {
          const sourceFile = Bun.file(input.file_path)
          if (!(await sourceFile.exists())) {
            throw new Error(`File "${input.file_path}" not found`)
          }

          const stored = await ctx.storage.putFile(input.file_path)
          const existing = await ctx.db.query.files.findFirst({
            where: eq(schema.files.hash, stored.hash),
          })

          if (!existing) {
            const mimeType = sourceFile.type || "application/octet-stream"
            const originalName = input.name ?? basename(input.file_path)
            await ensureStoredFileRecord(ctx.db, {
              stored,
              originalName,
              mimeType,
            })
          }

          return stored
        },
      })
      .mutation("deleteFile", {
        input: z.object({ hash: fileHashSchema }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          const file = await ctx.db.query.files.findFirst({
            where: eq(schema.files.hash, input.hash),
          })
          if (!file) return { success: false }

          const thumbnails = await ctx.db.query.fileThumbnails.findMany({
            where: eq(schema.fileThumbnails.file_hash, input.hash),
          })

          for (const thumbnail of thumbnails) {
            await removeFilePath(thumbnail.storage_path)
          }

          await ctx.db.delete(schema.files).where(eq(schema.files.hash, input.hash))
          await ctx.storage.remove(input.hash)

          return { success: true }
        },
      })
      .mutation("attachFile", {
        input: z.object({
          item_id: z.string(),
          file_hash: fileHashSchema,
          field_id: z.string().optional(),
          metadata: fileMetadataSchema.optional(),
        }),
        output: z.object({ id: z.string() }),
        resolve: async ({ input, ctx }) => {
          const item = await ctx.db.query.items.findFirst({
            where: eq(schema.items.id, input.item_id),
          })
          if (!item) {
            throw new Error(`Item ${input.item_id} not found`)
          }

          const file = await ctx.db.query.files.findFirst({
            where: eq(schema.files.hash, input.file_hash),
          })
          if (!file) {
            throw new Error(`File ${input.file_hash} not found`)
          }

          if (input.field_id) {
            const field = await ctx.db.query.fields.findFirst({
              where: eq(schema.fields.id, input.field_id),
            })
            if (!field || field.collection_id !== item.collection_id) {
              throw new Error(`Field ${input.field_id} not found for item ${input.item_id}`)
            }
          }

          const attachmentWhere = input.field_id
            ? and(
                eq(schema.itemFiles.item_id, input.item_id),
                eq(schema.itemFiles.field_id, input.field_id),
              )
            : eq(schema.itemFiles.item_id, input.item_id)
          const existingAttachments = await ctx.db.query.itemFiles.findMany({
            where: attachmentWhere,
          })
          const sortOrder =
            existingAttachments.reduce(
              (max, attachment) => Math.max(max, attachment.sort_order ?? 0),
              -1,
            ) + 1
          const id = crypto.randomUUID()

          await ctx.db.insert(schema.itemFiles).values({
            id,
            item_id: input.item_id,
            field_id: input.field_id,
            file_hash: input.file_hash,
            sort_order: sortOrder,
            metadata: serializeMetadata(input.metadata),
            created_at: Date.now(),
          })

          await ctx.db
            .update(schema.files)
            .set({ ref_count: (file.ref_count ?? 0) + 1 })
            .where(eq(schema.files.hash, input.file_hash))

          return { id }
        },
      })
      .mutation("detachFile", {
        input: z.object({ item_file_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          const itemFile = await ctx.db.query.itemFiles.findFirst({
            where: eq(schema.itemFiles.id, input.item_file_id),
          })
          if (!itemFile) return { success: false }

          const file = await ctx.db.query.files.findFirst({
            where: eq(schema.files.hash, itemFile.file_hash),
          })

          await ctx.db.delete(schema.itemFiles).where(eq(schema.itemFiles.id, input.item_file_id))

          if (file) {
            await ctx.db
              .update(schema.files)
              .set({ ref_count: Math.max((file.ref_count ?? 0) - 1, 0) })
              .where(eq(schema.files.hash, itemFile.file_hash))
          }

          return { success: true }
        },
      })
      .mutation("updateItemFile", {
        input: z.object({
          item_file_id: z.string(),
          metadata: fileMetadataSchema.nullable().optional(),
        }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          const itemFile = await ctx.db.query.itemFiles.findFirst({
            where: eq(schema.itemFiles.id, input.item_file_id),
          })
          if (!itemFile) return { success: false }

          if (input.metadata !== undefined) {
            await ctx.db
              .update(schema.itemFiles)
              .set({ metadata: input.metadata ? serializeMetadata(input.metadata) : null })
              .where(eq(schema.itemFiles.id, input.item_file_id))
          }

          return { success: true }
        },
      })
      .mutation("reorderItemFiles", {
        input: z.object({ item_file_ids: z.array(z.string()) }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          for (let i = 0; i < input.item_file_ids.length; i++) {
            await ctx.db
              .update(schema.itemFiles)
              .set({ sort_order: i })
              .where(eq(schema.itemFiles.id, input.item_file_ids[i]))
          }

          return { success: true }
        },
      })
      .query("getFile", {
        input: z.object({ hash: fileHashSchema }),
        output: z.object({ file: fileSchema.nullable() }),
        resolve: async ({ input, ctx }) => {
          const file = await ctx.db.query.files.findFirst({
            where: eq(schema.files.hash, input.hash),
          })

          return { file: file ? parseFile(file) : null }
        },
      })
      .query("fileExists", {
        input: z.object({ hash: fileHashSchema }),
        output: z.object({ exists: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          const file = await ctx.db.query.files.findFirst({
            where: eq(schema.files.hash, input.hash),
          })

          return { exists: file ? await ctx.storage.exists(input.hash) : false }
        },
      })
      .query("getFilePath", {
        input: z.object({ hash: fileHashSchema }),
        output: z.object({ path: z.string() }),
        resolve: async ({ input, ctx }) => {
          const file = await getExistingFile(ctx.db, input.hash)
          return { path: file.storage_path }
        },
      })
      .query("getFileStreamUrl", {
        input: z.object({ hash: fileHashSchema }),
        output: z.object({ url: z.string() }),
        resolve: async ({ input, ctx }) => {
          const file = await getExistingFile(ctx.db, input.hash)
          return { url: pathToFileURL(file.storage_path).href }
        },
      })
      .query("readFileChunk", {
        input: z.object({
          hash: fileHashSchema,
          offset: z.number().int().nonnegative(),
          length: z.number().int().positive().max(maxFileChunkBytes),
        }),
        output: z.object({
          data_base64: z.string(),
          offset: z.number(),
          length: z.number(),
          total: z.number(),
          done: z.boolean(),
          mime_type: z.string(),
          original_name: z.string(),
        }),
        resolve: async ({ input, ctx }) => {
          const file = await getExistingFile(ctx.db, input.hash)
          const chunk = await readBase64Chunk({
            path: file.storage_path,
            total: file.size,
            offset: input.offset,
            length: input.length,
          })

          return {
            ...chunk,
            offset: input.offset,
            total: file.size,
            mime_type: file.mime_type,
            original_name: file.original_name,
          }
        },
      })
      .query("getItemFiles", {
        input: z.object({ item_id: z.string() }),
        output: z.object({ files: z.array(itemFileWithFileSchema) }),
        resolve: async ({ input, ctx }) => {
          return { files: await getItemFileAttachments(ctx.db, input.item_id) }
        },
      })
      .query("getItemFieldFiles", {
        input: z.object({ item_id: z.string(), field_id: z.string() }),
        output: z.object({ files: z.array(itemFileWithFileSchema) }),
        resolve: async ({ input, ctx }) => {
          return { files: await getItemFileAttachments(ctx.db, input.item_id, input.field_id) }
        },
      })
      // ── Thumbnails ─────────────────────────────────────────────────────────
      .mutation("generateThumbnails", {
        input: z.object({
          file_hash: fileHashSchema,
          sizes: z.array(thumbnailSizeSchema).optional(),
        }),
        output: z.object({ thumbnails: z.array(fileThumbnailSchema) }),
        resolve: async ({ input, ctx }) => {
          const file = await getExistingFile(ctx.db, input.file_hash)
          if (!file.mime_type.startsWith("image/")) {
            throw new Error(`Thumbnails are only supported for images, got ${file.mime_type}`)
          }

          const sizes = input.sizes ?? [...thumbnailSizes]
          const thumbnails: Array<z.infer<typeof fileThumbnailSchema>> = []

          for (const size of sizes) {
            const targetPath = getThumbnailPath(ctx.thumbnailsDir, input.file_hash, size)
            const dimensions = await writeImageThumbnail(
              file.storage_path,
              targetPath,
              thumbnailDimensions[size],
            )
            const existing = await ctx.db.query.fileThumbnails.findFirst({
              where: and(
                eq(schema.fileThumbnails.file_hash, input.file_hash),
                eq(schema.fileThumbnails.size_name, size),
              ),
            })
            const now = Date.now()

            if (existing) {
              await ctx.db
                .update(schema.fileThumbnails)
                .set({
                  width: dimensions.width,
                  height: dimensions.height,
                  format: "webp",
                  storage_path: targetPath,
                  created_at: now,
                })
                .where(eq(schema.fileThumbnails.id, existing.id))
            } else {
              await ctx.db.insert(schema.fileThumbnails).values({
                id: crypto.randomUUID(),
                file_hash: input.file_hash,
                size_name: size,
                width: dimensions.width,
                height: dimensions.height,
                format: "webp",
                storage_path: targetPath,
                created_at: now,
              })
            }

            const thumbnail = await ctx.db.query.fileThumbnails.findFirst({
              where: and(
                eq(schema.fileThumbnails.file_hash, input.file_hash),
                eq(schema.fileThumbnails.size_name, size),
              ),
            })
            if (!thumbnail) {
              throw new Error(`Thumbnail ${size} for file ${input.file_hash} not found after write`)
            }

            thumbnails.push(parseThumbnail(thumbnail))
          }

          return { thumbnails }
        },
      })
      .query("getThumbnail", {
        input: z.object({ file_hash: fileHashSchema, size: thumbnailSizeSchema }),
        output: z.object({ thumbnail: fileThumbnailSchema.nullable() }),
        resolve: async ({ input, ctx }) => {
          const thumbnail = await ctx.db.query.fileThumbnails.findFirst({
            where: and(
              eq(schema.fileThumbnails.file_hash, input.file_hash),
              eq(schema.fileThumbnails.size_name, input.size),
            ),
          })

          return { thumbnail: thumbnail ? parseThumbnail(thumbnail) : null }
        },
      })
      .query("getFileThumbnails", {
        input: z.object({ file_hash: fileHashSchema }),
        output: z.object({ thumbnails: z.array(fileThumbnailSchema) }),
        resolve: async ({ input, ctx }) => {
          const thumbnails = await ctx.db.query.fileThumbnails.findMany({
            where: eq(schema.fileThumbnails.file_hash, input.file_hash),
            orderBy: asc(schema.fileThumbnails.size_name),
          })

          return { thumbnails: thumbnails.map(parseThumbnail) }
        },
      })
      .query("getThumbnailPath", {
        input: z.object({ file_hash: fileHashSchema, size: thumbnailSizeSchema }),
        output: z.object({ path: z.string() }),
        resolve: async ({ input, ctx }) => {
          const thumbnail = await ctx.db.query.fileThumbnails.findFirst({
            where: and(
              eq(schema.fileThumbnails.file_hash, input.file_hash),
              eq(schema.fileThumbnails.size_name, input.size),
            ),
          })
          if (!thumbnail) {
            throw new Error(`Thumbnail ${input.size} for file ${input.file_hash} not found`)
          }

          return { path: thumbnail.storage_path }
        },
      })
      .query("readThumbnailChunk", {
        input: z.object({
          file_hash: fileHashSchema,
          size: thumbnailSizeSchema,
          offset: z.number().int().nonnegative(),
          length: z.number().int().positive().max(maxFileChunkBytes),
        }),
        output: z.object({
          data_base64: z.string(),
          offset: z.number(),
          length: z.number(),
          total: z.number(),
          done: z.boolean(),
          mime_type: z.string(),
          original_name: z.string(),
        }),
        resolve: async ({ input, ctx }) => {
          const thumbnail = await ctx.db.query.fileThumbnails.findFirst({
            where: and(
              eq(schema.fileThumbnails.file_hash, input.file_hash),
              eq(schema.fileThumbnails.size_name, input.size),
            ),
          })
          if (!thumbnail) {
            throw new Error(`Thumbnail ${input.size} for file ${input.file_hash} not found`)
          }

          const total = Bun.file(thumbnail.storage_path).size
          const chunk = await readBase64Chunk({
            path: thumbnail.storage_path,
            total,
            offset: input.offset,
            length: input.length,
          })

          return {
            ...chunk,
            offset: input.offset,
            total,
            mime_type: "image/webp",
            original_name: `${input.file_hash}_${input.size}.webp`,
          }
        },
      })
      // ── Versions ──────────────────────────────────────────────────────────
      .query("getItemVersions", {
        input: z.object({ item_id: z.string() }),
        output: z.object({ versions: z.array(itemVersionSchema) }),
        resolve: async ({ input, ctx }) => {
          const versions = await ctx.db.query.itemVersions.findMany({
            where: eq(schema.itemVersions.item_id, input.item_id),
            orderBy: desc(schema.itemVersions.version),
          })
          return { versions: versions.map(parseVersion) }
        },
      })
      .query("getItemVersion", {
        input: z.object({ version_id: z.string() }),
        output: z.object({ version: itemVersionSchema.nullable() }),
        resolve: async ({ input, ctx }) => {
          const version = await ctx.db.query.itemVersions.findFirst({
            where: eq(schema.itemVersions.id, input.version_id),
          })
          if (!version) return { version: null }
          return { version: parseVersion(version) }
        },
      })
      .query("countVersions", {
        input: z.object({ item_id: z.string() }),
        output: z.object({ count: z.number() }),
        resolve: async ({ input, ctx }) => {
          const versions = await ctx.db.query.itemVersions.findMany({
            where: eq(schema.itemVersions.item_id, input.item_id),
          })
          return { count: versions.length }
        },
      })
      .mutation("restoreItemVersion", {
        input: z.object({ version_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx, emit }) => {
          const version = await ctx.db.query.itemVersions.findFirst({
            where: eq(schema.itemVersions.id, input.version_id),
          })
          if (!version) {
            throw new Error(`Version ${input.version_id} not found`)
          }

          const item = await ctx.db.query.items.findFirst({
            where: eq(schema.items.id, version.item_id),
          })
          if (!item) {
            throw new Error(`Item ${version.item_id} not found`)
          }

          const fields = await ctx.db.query.fields.findMany({
            where: eq(schema.fields.collection_id, item.collection_id),
          })
          const currentData = safeJsonParse<Record<string, unknown>>(item.data, `item ${item.id}`)
          const versionData = safeJsonParse<Record<string, unknown>>(
            version.data,
            `version ${version.id}`,
          )
          const now = Date.now()
          const restoredData = applyGeneratedFieldValues(versionData, fields, {
            itemId: item.id,
            now,
            createdAt: item.created_at,
            currentData,
          })

          await ctx.db
            .update(schema.items)
            .set({ data: JSON.stringify(restoredData), updated_at: now })
            .where(eq(schema.items.id, version.item_id))

          await emit.versionRestored(parseVersion(version))
          return { success: true }
        },
      })
      // ── Manifest ──────────────────────────────────────────────────────────
      .query("getManifest", {
        input: z.void(),
        output: manifestSchema,
        resolve: async ({ ctx }) => {
          const rows = await ctx.db.query.collections.findMany({
            where: isNull(schema.collections.deleted_at),
            orderBy: asc(schema.collections.name),
          })

          const collections = await Promise.all(
            rows.map(async (row) => {
              const fields = await ctx.db.query.fields.findMany({
                where: eq(schema.fields.collection_id, row.id),
              })
              return {
                id: row.id,
                name: row.name,
                labels: row.labels
                  ? safeJsonParse<Record<string, string>>(row.labels, `collection ${row.id} labels`)
                  : undefined,
                description: row.description ?? undefined,
                icon: row.icon ?? undefined,
                singleton: row.singleton ?? undefined,
                fields: fields.map(parseStoredManifestField),
              }
            }),
          )

          return { collections }
        },
      })
      .mutation("applyManifest", {
        input: z.object({
          manifest: manifestSchema,
        }),
        output: z.object({
          created: z.array(z.string()),
          updated: z.array(z.string()),
          skipped: z.array(z.string()),
        }),
        resolve: async ({ input, ctx, emit }) => {
          const { manifest } = input
          const now = Date.now()

          const created: string[] = []
          const updated: string[] = []
          const skipped: string[] = []

          for (const colDef of manifest.collections) {
            const existing = await ctx.db.query.collections.findFirst({
              where: and(
                eq(schema.collections.id, colDef.id),
                isNull(schema.collections.deleted_at),
              ),
            })

            if (existing) {
              const existingFields = await ctx.db.query.fields.findMany({
                where: eq(schema.fields.collection_id, existing.id),
              })
              const existingFieldNames = new Set(existingFields.map((f) => f.name))

              let fieldsChanged = false

              if (colDef.labels) {
                await ctx.db
                  .update(schema.collections)
                  .set({ labels: JSON.stringify(colDef.labels), updated_at: now })
                  .where(eq(schema.collections.id, existing.id))
                fieldsChanged = true
              }

              const manifestFieldNames = new Set(colDef.fields.map((f) => f.name))

              // Add missing fields
              for (const fieldDef of colDef.fields) {
                if (!existingFieldNames.has(fieldDef.name)) {
                  await ctx.db.insert(schema.fields).values({
                    id: crypto.randomUUID(),
                    collection_id: existing.id,
                    name: fieldDef.name,
                    labels: fieldDef.labels ? JSON.stringify(fieldDef.labels) : null,
                    type: fieldDef.type,
                    required: fieldDef.required ?? false,
                    hidden: fieldDef.hidden ?? false,
                    readonly: fieldDef.readonly ?? false,
                    system: fieldDef.system ?? false,
                    special: fieldDef.special ?? null,
                    default_value: serializeFieldDefaultValue(fieldDef.default),
                    interface_options: serializeFieldOptions(
                      fieldDef.type,
                      fieldDef.options,
                      fieldDef.relation,
                    ),
                    meta: fieldDef.meta ? JSON.stringify(fieldDef.meta) : null,
                  })
                  fieldsChanged = true

                  const fieldSpecial = parseFieldSpecial(fieldDef.special)
                  const hasDefault = fieldDef.default !== null && fieldDef.default !== undefined
                  if (colDef.singleton && (fieldSpecial || hasDefault)) {
                    const singletonItem = await ctx.db.query.items.findFirst({
                      where: eq(schema.items.collection_id, existing.id),
                    })
                    if (singletonItem) {
                      const data = safeJsonParse<Record<string, unknown>>(
                        singletonItem.data,
                        `singleton ${existing.id}`,
                      )
                      const nextData = fieldSpecial
                        ? applyGeneratedFieldValues(data, [fieldDef], {
                            itemId: singletonItem.id,
                            now,
                            createdAt: singletonItem.created_at,
                            currentData: data,
                          })
                        : { ...data, [fieldDef.name]: fieldDef.default }

                      if (
                        !hasStoredValue(data[fieldDef.name]) &&
                        nextData[fieldDef.name] !== undefined
                      ) {
                        await ctx.db
                          .update(schema.items)
                          .set({ data: JSON.stringify(nextData), updated_at: now })
                          .where(eq(schema.items.id, singletonItem.id))
                      }
                    }
                  }
                }
              }

              // Update existing fields that differ from manifest
              for (const fieldDef of colDef.fields) {
                const existingField = existingFields.find((f) => f.name === fieldDef.name)
                if (!existingField) continue

                const newLabels = fieldDef.labels ? JSON.stringify(fieldDef.labels) : null
                const newRequired = fieldDef.required ?? false
                const newHidden = fieldDef.hidden ?? false
                const newReadonly = fieldDef.readonly ?? false
                const newSystem = fieldDef.system ?? false
                const newDefault = serializeFieldDefaultValue(fieldDef.default)
                const newOptions = serializeFieldOptions(
                  fieldDef.type,
                  fieldDef.options,
                  fieldDef.relation,
                )
                const newMeta = fieldDef.meta ? JSON.stringify(fieldDef.meta) : null

                if (
                  existingField.type !== fieldDef.type ||
                  existingField.required !== newRequired ||
                  existingField.hidden !== newHidden ||
                  existingField.readonly !== newReadonly ||
                  existingField.system !== newSystem ||
                  existingField.special !== (fieldDef.special ?? null) ||
                  existingField.labels !== newLabels ||
                  existingField.default_value !== newDefault ||
                  existingField.interface_options !== newOptions ||
                  existingField.meta !== newMeta
                ) {
                  await ctx.db
                    .update(schema.fields)
                    .set({
                      type: fieldDef.type,
                      labels: newLabels,
                      required: newRequired,
                      hidden: newHidden,
                      readonly: newReadonly,
                      system: newSystem,
                      special: fieldDef.special ?? null,
                      default_value: newDefault,
                      interface_options: newOptions,
                      meta: newMeta,
                    })
                    .where(eq(schema.fields.id, existingField.id))
                  fieldsChanged = true
                }
              }

              // Remove fields not in manifest
              for (const existingField of existingFields) {
                if (!manifestFieldNames.has(existingField.name)) {
                  await ctx.db.delete(schema.fields).where(eq(schema.fields.id, existingField.id))
                  fieldsChanged = true
                }
              }

              if (fieldsChanged) {
                await ctx.db
                  .update(schema.collections)
                  .set({ updated_at: now })
                  .where(eq(schema.collections.id, existing.id))
                updated.push(colDef.id)
              } else {
                skipped.push(colDef.id)
              }
            } else {
              await ctx.db.insert(schema.collections).values({
                id: colDef.id,
                name: colDef.name,
                labels: colDef.labels ? JSON.stringify(colDef.labels) : null,
                description: colDef.description,
                icon: colDef.icon,
                singleton: colDef.singleton,
                created_at: now,
                updated_at: now,
              })

              for (const fieldDef of colDef.fields) {
                await ctx.db.insert(schema.fields).values({
                  id: crypto.randomUUID(),
                  collection_id: colDef.id,
                  name: fieldDef.name,
                  labels: fieldDef.labels ? JSON.stringify(fieldDef.labels) : null,
                  type: fieldDef.type,
                  required: fieldDef.required ?? false,
                  hidden: fieldDef.hidden ?? false,
                  readonly: fieldDef.readonly ?? false,
                  system: fieldDef.system ?? false,
                  special: fieldDef.special ?? null,
                  default_value: serializeFieldDefaultValue(fieldDef.default),
                  interface_options: serializeFieldOptions(
                    fieldDef.type,
                    fieldDef.options,
                    fieldDef.relation,
                  ),
                  meta: fieldDef.meta ? JSON.stringify(fieldDef.meta) : null,
                })
              }

              const collection = await getCollectionWithFields(ctx.db, colDef.id)
              if (collection) await emit.collectionCreated(collection)
              created.push(colDef.id)
            }

            if (colDef.singleton) {
              const existingItems = await ctx.db.query.items.findFirst({
                where: eq(schema.items.collection_id, colDef.id),
              })
              if (!existingItems) {
                const defaultData: Record<string, unknown> = {}
                for (const fieldDef of colDef.fields) {
                  if (fieldDef.default !== null && fieldDef.default !== undefined) {
                    defaultData[fieldDef.name] = fieldDef.default
                  }
                }
                const id = crypto.randomUUID()
                const singletonData = applyGeneratedFieldValues(defaultData, colDef.fields, {
                  itemId: id,
                  now,
                })
                await ctx.db.insert(schema.items).values({
                  id,
                  collection_id: colDef.id,
                  data: JSON.stringify(singletonData),
                  created_at: now,
                  updated_at: now,
                })
                const item = await ctx.db.query.items.findFirst({
                  where: eq(schema.items.id, id),
                })
                if (item) await emit.itemCreated(parseItem(item))
              }
            }
          }

          return { created, updated, skipped }
        },
      })
      // ── Singleton helpers ─────────────────────────────────────────────────
      .query("getSingleton", {
        input: z.object({ collection_id: z.string() }),
        output: z.object({ item: itemSchema.nullable() }),
        resolve: async ({ input, ctx }) => {
          const collection = await ctx.db.query.collections.findFirst({
            where: and(
              eq(schema.collections.id, input.collection_id),
              isNull(schema.collections.deleted_at),
            ),
          })
          if (!collection) {
            throw new Error(`Collection ${input.collection_id} not found`)
          }

          const row = await ctx.db.query.items.findFirst({
            where: eq(schema.items.collection_id, input.collection_id),
          })
          return { item: row ? parseItem(row) : null }
        },
      })
      .mutation("updateSingleton", {
        input: z.object({
          collection_id: z.string(),
          data: z.record(z.string(), z.any()),
          source: z.string().optional(),
        }),
        output: z.object({ id: z.string() }),
        resolve: async ({ input, ctx, emit }) => {
          const collection = await ctx.db.query.collections.findFirst({
            where: and(
              eq(schema.collections.id, input.collection_id),
              isNull(schema.collections.deleted_at),
            ),
          })
          if (!collection) {
            throw new Error(`Collection ${input.collection_id} not found`)
          }

          const row = await ctx.db.query.items.findFirst({
            where: eq(schema.items.collection_id, input.collection_id),
          })
          if (!row) {
            throw new Error(
              `Singleton item for collection "${input.collection_id}" not found. Call applyManifest first.`,
            )
          }

          const currentData = safeJsonParse<Record<string, unknown>>(
            row.data,
            `singleton item ${row.id}`,
          )
          const mergedInputData = { ...currentData, ...input.data }

          const fields = await ctx.db.query.fields.findMany({
            where: eq(schema.fields.collection_id, input.collection_id),
          })

          const now = Date.now()
          const mergedData = applyGeneratedFieldValues(mergedInputData, fields, {
            itemId: row.id,
            now,
            createdAt: row.created_at,
            currentData,
          })

          validateItemData(fields, mergedData, {
            validateFieldNames: buildUpdatedFieldValidationNames(input.data, fields),
          })

          await ctx.db
            .update(schema.items)
            .set({
              data: JSON.stringify(mergedData),
              source: input.source,
              updated_at: now,
            })
            .where(eq(schema.items.id, row.id))

          const updated = await ctx.db.query.items.findFirst({
            where: eq(schema.items.id, row.id),
          })
          if (!updated) throw new Error(`Singleton item ${row.id} not found after update`)
          await emit.itemUpdated(parseItem(updated))
          return { id: row.id }
        },
      })
      .subscription("singletonUpdated", { output: itemSchema })
  )
})

async function getCollectionFieldTypes(
  db: DataEngine["db"],
  collectionId: string,
): Promise<Map<string, FieldType>> {
  const fields = await db.query.fields.findMany({
    where: eq(schema.fields.collection_id, collectionId),
  })
  const map = new Map<string, FieldType>()
  for (const f of fields) {
    map.set(f.name, f.type as FieldType)
  }
  return map
}

async function getCollectionWithFields(
  db: DataEngine["db"],
  collectionId: string,
): Promise<z.infer<typeof collectionSchema> | null> {
  const collection = await db.query.collections.findFirst({
    where: and(eq(schema.collections.id, collectionId), isNull(schema.collections.deleted_at)),
  })
  if (!collection) return null

  const fields = await db.query.fields.findMany({
    where: eq(schema.fields.collection_id, collectionId),
  })

  return {
    ...collection,
    labels: collection.labels
      ? safeJsonParse<Record<string, string>>(
          collection.labels,
          `collection ${collectionId} labels`,
        )
      : undefined,
    meta: collection.meta
      ? safeJsonParse<Record<string, unknown>>(collection.meta, `collection ${collectionId} meta`)
      : undefined,
    fields: fields.map(parseStoredField),
  }
}

async function ensureStoredFileRecord(
  db: DataEngine["db"],
  input: {
    stored: { hash: string; size: number; path: string }
    originalName: string
    mimeType: string
  },
): Promise<z.infer<typeof fileSchema>> {
  const existing = await db.query.files.findFirst({
    where: eq(schema.files.hash, input.stored.hash),
  })
  if (existing) {
    return parseFile(existing)
  }

  const image = await extractImageMetadata(input.stored.path, input.mimeType)

  await db.insert(schema.files).values({
    hash: input.stored.hash,
    original_name: input.originalName,
    mime_type: input.mimeType,
    size: input.stored.size,
    storage_path: input.stored.path,
    ref_count: 0,
    width: image.width,
    height: image.height,
    metadata: serializeMetadata(image.metadata),
    created_at: Date.now(),
  })

  const file = await getExistingFile(db, input.stored.hash)
  return parseFile(file)
}

async function getExistingFile(
  db: DataEngine["db"],
  hash: string,
): Promise<typeof schema.files.$inferSelect> {
  const file = await db.query.files.findFirst({
    where: eq(schema.files.hash, hash),
  })
  if (!file) {
    throw new Error(`File ${hash} not found`)
  }

  return file
}

async function getItemFileAttachments(
  db: DataEngine["db"],
  itemId: string,
  fieldId?: string,
): Promise<Array<z.infer<typeof itemFileWithFileSchema>>> {
  const where = fieldId
    ? and(eq(schema.itemFiles.item_id, itemId), eq(schema.itemFiles.field_id, fieldId))
    : eq(schema.itemFiles.item_id, itemId)
  const itemFiles = await db.query.itemFiles.findMany({
    where,
    orderBy: asc(schema.itemFiles.sort_order),
  })
  const attachments: Array<z.infer<typeof itemFileWithFileSchema>> = []

  for (const itemFile of itemFiles) {
    const file = await db.query.files.findFirst({
      where: eq(schema.files.hash, itemFile.file_hash),
    })
    if (file) {
      attachments.push({ ...parseItemFile(itemFile), file: parseFile(file) })
    }
  }

  return attachments
}

function parseFile(file: typeof schema.files.$inferSelect): z.infer<typeof fileSchema> {
  return {
    hash: file.hash,
    original_name: file.original_name,
    mime_type: file.mime_type,
    size: file.size,
    storage_path: file.storage_path,
    ref_count: file.ref_count,
    width: file.width,
    height: file.height,
    duration: file.duration,
    frame_rate: file.frame_rate,
    video_codec: file.video_codec,
    audio_codec: file.audio_codec,
    bitrate: file.bitrate,
    sample_rate: file.sample_rate,
    channels: file.channels,
    orientation: file.orientation,
    color_space: file.color_space,
    metadata: file.metadata
      ? safeJsonParse<Record<string, unknown>>(file.metadata, `file ${file.hash} metadata`)
      : undefined,
    created_at: file.created_at,
  }
}

function parseItemFile(
  itemFile: typeof schema.itemFiles.$inferSelect,
): z.infer<typeof itemFileSchema> {
  return {
    id: itemFile.id,
    item_id: itemFile.item_id,
    field_id: itemFile.field_id,
    file_hash: itemFile.file_hash,
    sort_order: itemFile.sort_order,
    metadata: itemFile.metadata
      ? safeJsonParse<Record<string, unknown>>(
          itemFile.metadata,
          `item_file ${itemFile.id} metadata`,
        )
      : undefined,
    created_at: itemFile.created_at,
  }
}

function parseThumbnail(
  thumbnail: typeof schema.fileThumbnails.$inferSelect,
): z.infer<typeof fileThumbnailSchema> {
  return {
    id: thumbnail.id,
    file_hash: thumbnail.file_hash,
    size_name: thumbnail.size_name,
    width: thumbnail.width,
    height: thumbnail.height,
    format: thumbnail.format,
    storage_path: thumbnail.storage_path,
    created_at: thumbnail.created_at,
  }
}

function parseItem(item: {
  id: string
  collection_id: string
  data: string
  created_at: number
  updated_at: number
  deleted_at: number | null
  schema_version: number | null
  source: string | null
}): z.infer<typeof itemSchema> {
  return {
    id: item.id,
    collection_id: item.collection_id,
    data: safeJsonParse(item.data, `item ${item.id}`),
    created_at: item.created_at,
    updated_at: item.updated_at,
    deleted_at: item.deleted_at,
    schema_version: item.schema_version,
    source: item.source,
  }
}

function parseVersion(version: {
  id: string
  item_id: string
  version: number
  data: string
  source: string | null
  created_at: number
}): z.infer<typeof itemVersionSchema> {
  return {
    ...version,
    data: safeJsonParse(version.data, `version ${version.id}`),
  }
}

export default dataModule
