import { join } from "path"
import { z } from "zod"
import { eq, and, desc, asc, isNull, isNotNull } from "drizzle-orm"
import { createEdemModule } from "@exodus/edem-core"
import { createDataEngine, type DataEngine } from "./db"
import * as schema from "./schema"
import {
  fieldSchema,
  fieldInputSchema,
  fieldTypes,
  validateFieldValue,
  type FieldType,
} from "./fields"
import { matchFilter, sortItems, filterSchema, sortSchema } from "./filters"

function safeJsonParse<T>(value: string, context: string): T {
  try {
    return JSON.parse(value) as T
  } catch {
    throw new Error(`Failed to parse JSON in ${context}`)
  }
}

const collectionSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  slug: z.string(),
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

const projectSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  is_default: z.boolean().nullable().optional(),
  sort_order: z.number().nullable().optional(),
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

export const dataModule = createEdemModule("data", (module) => {
  return (
    module
      .context(async (config) => {
        const dbPath = config.appData ? join(config.appData, "data.db") : ":memory:"
        const engine = createDataEngine({ dbPath })
        return { db: engine.db, engine }
      })
      // ── Subscriptions ──────────────────────────────────────────────────────
      .subscription("projectCreated", { output: projectSchema })
      .subscription("projectUpdated", { output: projectSchema })
      .subscription("projectDeleted", { output: z.object({ project_id: z.string() }) })
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
      // ── Projects ──────────────────────────────────────────────────────────
      .mutation("createProject", {
        input: z.object({
          name: z.string(),
          slug: z.string().optional(),
          description: z.string().optional(),
          icon: z.string().optional(),
          color: z.string().optional(),
        }),
        output: z.object({ id: z.string() }),
        resolve: async ({ input, ctx, emit }) => {
          const id = crypto.randomUUID()
          const now = Date.now()
          const slug = input.slug ?? input.name.toLowerCase().replace(/\s+/g, "-")

          await ctx.db.insert(schema.projects).values({
            id,
            slug,
            name: input.name,
            description: input.description,
            icon: input.icon,
            color: input.color,
            created_at: now,
            updated_at: now,
          })

          const project = await ctx.db.query.projects.findFirst({
            where: eq(schema.projects.id, id),
          })
          if (!project) throw new Error(`Project ${id} not found after creation`)
          await emit.projectCreated(project)
          return { id }
        },
      })
      .mutation("updateProject", {
        input: z.object({
          project_id: z.string(),
          name: z.string().optional(),
          slug: z.string().optional(),
          description: z.string().optional(),
          icon: z.string().optional(),
          color: z.string().optional(),
          sort_order: z.number().optional(),
        }),
        output: z.object({ id: z.string() }),
        resolve: async ({ input, ctx, emit }) => {
          const { project_id, ...updates } = input
          const now = Date.now()

          await ctx.db
            .update(schema.projects)
            .set({ ...updates, updated_at: now })
            .where(eq(schema.projects.id, project_id))

          const project = await ctx.db.query.projects.findFirst({
            where: eq(schema.projects.id, project_id),
          })
          if (!project) throw new Error(`Project ${project_id} not found`)
          await emit.projectUpdated(project)
          return { id: project_id }
        },
      })
      .mutation("deleteProject", {
        input: z.object({ project_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx, emit }) => {
          await ctx.db
            .update(schema.projects)
            .set({ deleted_at: Date.now() })
            .where(eq(schema.projects.id, input.project_id))
          await emit.projectDeleted({ project_id: input.project_id })
          return { success: true }
        },
      })
      .mutation("restoreProject", {
        input: z.object({ project_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          const project = await ctx.db.query.projects.findFirst({
            where: eq(schema.projects.id, input.project_id),
          })
          if (!project) throw new Error(`Project ${input.project_id} not found`)

          await ctx.db
            .update(schema.projects)
            .set({ deleted_at: null })
            .where(eq(schema.projects.id, input.project_id))
          return { success: true }
        },
      })
      .mutation("setDefaultProject", {
        input: z.object({ project_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, ctx }) => {
          await ctx.db.transaction(async (tx) => {
            await tx.update(schema.projects).set({ is_default: false })
            await tx
              .update(schema.projects)
              .set({ is_default: true })
              .where(eq(schema.projects.id, input.project_id))
          })
          return { success: true }
        },
      })
      .query("getProject", {
        input: z.object({ project_id: z.string() }),
        output: z.object({ project: projectSchema.nullable() }),
        resolve: async ({ input, ctx }) => {
          const project = await ctx.db.query.projects.findFirst({
            where: and(
              eq(schema.projects.id, input.project_id),
              isNull(schema.projects.deleted_at),
            ),
          })
          return { project: project ?? null }
        },
      })
      .query("listProjects", {
        input: z.void(),
        output: z.object({ projects: z.array(projectSchema) }),
        resolve: async ({ ctx }) => {
          const projects = await ctx.db.query.projects.findMany({
            where: isNull(schema.projects.deleted_at),
            orderBy: asc(schema.projects.sort_order),
          })
          return { projects }
        },
      })
      .query("getDefaultProject", {
        input: z.void(),
        output: z.object({ project: projectSchema.nullable() }),
        resolve: async ({ ctx }) => {
          const project = await ctx.db.query.projects.findFirst({
            where: and(eq(schema.projects.is_default, true), isNull(schema.projects.deleted_at)),
          })
          return { project: project ?? null }
        },
      })
      // ── Collections ───────────────────────────────────────────────────────
      .mutation("createCollection", {
        input: z.object({
          project_id: z.string(),
          name: z.string(),
          slug: z.string(),
          parent_id: z.string().optional(),
          description: z.string().optional(),
          icon: z.string().optional(),
          singleton: z.boolean().optional(),
          fields: z.array(fieldInputSchema).optional(),
          meta: z.record(z.string(), z.any()).optional(),
        }),
        output: z.object({ id: z.string() }),
        resolve: async ({ input, ctx, emit }) => {
          const id = crypto.randomUUID()
          const now = Date.now()

          await ctx.db.insert(schema.collections).values({
            id,
            project_id: input.project_id,
            parent_id: input.parent_id,
            slug: input.slug,
            name: input.name,
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
                collection_id: id,
                name: field.name,
                type: field.type,
                required: field.required,
                default_value:
                  field.default !== null && field.default !== undefined
                    ? JSON.stringify(field.default)
                    : null,
                interface_options: field.options ? JSON.stringify(field.options) : null,
                meta: field.meta ? JSON.stringify(field.meta) : null,
              })
            }
          }

          const collection = await getCollectionWithFields(ctx.db, id)
          if (!collection) throw new Error(`Collection ${id} not found after creation`)
          await emit.collectionCreated(collection)
          return { id }
        },
      })
      .mutation("updateCollection", {
        input: z.object({
          collection_id: z.string(),
          name: z.string().optional(),
          slug: z.string().optional(),
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
          const { collection_id, fields: newFields, meta, ...updates } = input
          const now = Date.now()

          const existing = await ctx.db.query.collections.findFirst({
            where: eq(schema.collections.id, collection_id),
          })
          if (!existing) {
            throw new Error(`Collection ${collection_id} not found`)
          }

          const updateData: Record<string, unknown> = { ...updates, updated_at: now }
          if (meta !== undefined) updateData.meta = JSON.stringify(meta)

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
                  type: field.type,
                  required: field.required,
                  default_value:
                    field.default !== null && field.default !== undefined
                      ? JSON.stringify(field.default)
                      : null,
                  interface_options: field.options ? JSON.stringify(field.options) : null,
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
        input: z.object({ project_id: z.string().optional() }),
        output: z.object({ collections: z.array(collectionSchema) }),
        resolve: async ({ input, ctx }) => {
          const conditions = [isNotNull(schema.collections.deleted_at)]
          if (input.project_id) {
            conditions.push(eq(schema.collections.project_id, input.project_id))
          }

          const rows = await ctx.db.query.collections.findMany({
            where: and(...conditions),
          })

          const collections = await Promise.all(
            rows.map(async (row) => {
              const fields = await ctx.db.query.fields.findMany({
                where: eq(schema.fields.collection_id, row.id),
              })
              return {
                ...row,
                meta: row.meta
                  ? safeJsonParse<Record<string, unknown>>(row.meta, `collection ${row.id} meta`)
                  : undefined,
                fields: fields.map((f) => ({
                  id: f.id,
                  collection_id: f.collection_id,
                  name: f.name,
                  type: f.type as FieldType,
                  options: f.interface_options
                    ? safeJsonParse<Record<string, unknown>>(
                        f.interface_options,
                        `field ${f.id} options`,
                      )
                    : undefined,
                  required: f.required ?? undefined,
                  default: f.default_value
                    ? safeJsonParse(f.default_value, `field ${f.id} default_value`)
                    : undefined,
                  meta: f.meta
                    ? safeJsonParse<Record<string, unknown>>(f.meta, `field ${f.id} meta`)
                    : undefined,
                })),
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
          project_id: z.string().optional(),
          parent_id: z.string().optional(),
        }),
        output: z.object({ collections: z.array(collectionSchema) }),
        resolve: async ({ input, ctx }) => {
          const conditions = [isNull(schema.collections.deleted_at)]
          if (input.project_id) {
            conditions.push(eq(schema.collections.project_id, input.project_id))
          }
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
          type: z.enum(fieldTypes),
          interface: z.string().optional(),
          display: z.string().optional(),
          required: z.boolean().optional(),
          hidden: z.boolean().optional(),
          readonly: z.boolean().optional(),
          special: z.string().optional(),
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

          const id = crypto.randomUUID()
          await ctx.db.insert(schema.fields).values({
            id,
            collection_id: input.collection_id,
            name: input.name,
            type: input.type,
            interface: input.interface,
            display: input.display,
            required: input.required ?? false,
            hidden: input.hidden ?? false,
            readonly: input.readonly ?? false,
            special: input.special,
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
          type: z.enum(fieldTypes).optional(),
          interface: z.string().optional(),
          display: z.string().optional(),
          required: z.boolean().optional(),
          hidden: z.boolean().optional(),
          readonly: z.boolean().optional(),
          default_value: z.any().optional(),
          validation: z.record(z.string(), z.any()).optional(),
          meta: z.record(z.string(), z.any()).optional(),
        }),
        output: z.object({ id: z.string() }),
        resolve: async ({ input, ctx }) => {
          const { field_id, default_value, validation, meta, ...updates } = input

          const field = await ctx.db.query.fields.findFirst({
            where: eq(schema.fields.id, field_id),
          })
          if (!field) throw new Error(`Field ${field_id} not found`)

          const updateData: Record<string, unknown> = { ...updates }
          if (default_value !== undefined) updateData.default_value = JSON.stringify(default_value)
          if (validation !== undefined) updateData.validation = JSON.stringify(validation)
          if (meta !== undefined) updateData.meta = JSON.stringify(meta)

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
            fields: fields.map((f) => ({
              id: f.id,
              collection_id: f.collection_id,
              name: f.name,
              type: f.type as FieldType,
              options: f.interface_options
                ? safeJsonParse<Record<string, unknown>>(
                    f.interface_options,
                    `field ${f.id} options`,
                  )
                : undefined,
              required: f.required ?? undefined,
              default: f.default_value
                ? safeJsonParse(f.default_value, `field ${f.id} default_value`)
                : undefined,
              meta: f.meta
                ? safeJsonParse<Record<string, unknown>>(f.meta, `field ${f.id} meta`)
                : undefined,
            })),
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
            field: {
              id: f.id,
              collection_id: f.collection_id,
              name: f.name,
              type: f.type as FieldType,
              options: f.interface_options
                ? safeJsonParse<Record<string, unknown>>(
                    f.interface_options,
                    `field ${f.id} options`,
                  )
                : undefined,
              required: f.required ?? undefined,
              default: f.default_value
                ? safeJsonParse(f.default_value, `field ${f.id} default_value`)
                : undefined,
              meta: f.meta
                ? safeJsonParse<Record<string, unknown>>(f.meta, `field ${f.id} meta`)
                : undefined,
            },
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

          const fields = await ctx.db.query.fields.findMany({
            where: eq(schema.fields.collection_id, input.collection_id),
          })

          for (const field of fields) {
            const value = input.data[field.name]
            if (field.required && (value === null || value === undefined)) {
              throw new Error(`Field "${field.name}" is required`)
            }
            const fieldType = field.type as FieldType
            if (value !== undefined && !validateFieldValue(fieldType, value)) {
              throw new Error(`Invalid value for field "${field.name}" of type "${field.type}"`)
            }
          }

          const id = crypto.randomUUID()
          const now = Date.now()

          await ctx.db.insert(schema.items).values({
            id,
            collection_id: input.collection_id,
            schema_version: collection.schema_version ?? 1,
            source: input.source,
            data: JSON.stringify(input.data),
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
          const mergedData = { ...currentData, ...input.data }

          const fields = await ctx.db.query.fields.findMany({
            where: eq(schema.fields.collection_id, item.collection_id),
          })

          for (const field of fields) {
            const value = input.data[field.name]
            const fieldType = field.type as FieldType
            if (value !== undefined && !validateFieldValue(fieldType, value)) {
              throw new Error(`Invalid value for field "${field.name}" of type "${field.type}"`)
            }
            if (
              field.required &&
              (mergedData[field.name] === null || mergedData[field.name] === undefined)
            ) {
              throw new Error(`Field "${field.name}" is required`)
            }
          }

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
              created_at: Date.now(),
            })
          }

          const now = Date.now()
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
            const mergedData = { ...currentData, ...input.data }

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
            const mergedData = { ...currentData, ...data }

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
            items = items.filter((item) =>
              matchFilter(item.data, input.filter as Record<string, unknown>),
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
        input: z.object({ item_id: z.string() }),
        output: z.object({ item: itemSchema.nullable() }),
        resolve: async ({ input, ctx }) => {
          const item = await ctx.db.query.items.findFirst({
            where: and(eq(schema.items.id, input.item_id), isNull(schema.items.deleted_at)),
          })
          return { item: item ? parseItem(item) : null }
        },
      })
      .query("queryItems", {
        input: z.object({
          collection_id: z.string(),
          filter: filterSchema.optional(),
          sort: sortSchema.optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
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

          if (input.filter) {
            items = items.filter((item) =>
              matchFilter(item.data, input.filter as Record<string, unknown>),
            )
          }

          const total = items.length

          if (input.sort) {
            items = sortItems(items, input.sort)
          }

          if (input.offset !== undefined) {
            items = items.slice(input.offset)
          }
          if (input.limit !== undefined) {
            items = items.slice(0, input.limit)
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

          await ctx.db
            .update(schema.items)
            .set({ data: version.data, updated_at: Date.now() })
            .where(eq(schema.items.id, version.item_id))

          await emit.versionRestored(parseVersion(version))
          return { success: true }
        },
      })
  )
})

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
    meta: collection.meta
      ? safeJsonParse<Record<string, unknown>>(collection.meta, `collection ${collectionId} meta`)
      : undefined,
    fields: fields.map((f) => ({
      id: f.id,
      collection_id: f.collection_id,
      name: f.name,
      type: f.type as FieldType,
      options: f.interface_options
        ? safeJsonParse<Record<string, unknown>>(f.interface_options, `field ${f.id} options`)
        : undefined,
      required: f.required ?? undefined,
      default: f.default_value
        ? safeJsonParse(f.default_value, `field ${f.id} default_value`)
        : undefined,
      meta: f.meta
        ? safeJsonParse<Record<string, unknown>>(f.meta, `field ${f.id} meta`)
        : undefined,
    })),
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
    ...item,
    data: safeJsonParse(item.data, `item ${item.id}`),
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
