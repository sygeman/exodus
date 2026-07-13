import { z } from "zod"
import type { edem } from "./edem"

const NavigateAction = z.object({
  action: z.literal("navigate"),
  path: z.string(),
})

const QueryDataAction = z.object({
  action: z.literal("query_data"),
  collection: z.string(),
  filter: z.record(z.string(), z.unknown()).optional(),
})

const CreateItemAction = z.object({
  action: z.literal("create_item"),
  collection: z.string(),
  data: z.record(z.string(), z.unknown()),
})

const UpdateItemAction = z.object({
  action: z.literal("update_item"),
  item_id: z.string(),
  data: z.record(z.string(), z.unknown()),
})

const DeleteItemAction = z.object({
  action: z.literal("delete_item"),
  item_id: z.string(),
})

const RunFlowAction = z.object({
  action: z.literal("run_flow"),
  flow_id: z.string(),
  input: z.record(z.string(), z.unknown()).optional(),
})

const UpdateSettingAction = z.object({
  action: z.literal("update_setting"),
  key: z.string(),
  value: z.unknown(),
})

const AgentActionSchema = z.discriminatedUnion("action", [
  NavigateAction,
  QueryDataAction,
  CreateItemAction,
  UpdateItemAction,
  DeleteItemAction,
  RunFlowAction,
  UpdateSettingAction,
])

export type AgentAction = z.infer<typeof AgentActionSchema>

export interface ActionResult {
  action: string
  success: boolean
  data?: unknown
  error?: string
}

export function parseActions(text: string): AgentAction[] {
  const actions: AgentAction[] = []
  const jsonBlockRegex = /```json\s*([\s\S]*?)```/g
  const inlineJsonRegex = /\{[^{}]*"action"\s*:\s*"[^"]+?"[^{}]*\}/g

  for (const match of text.matchAll(jsonBlockRegex)) {
    try {
      const parsed = JSON.parse(match[1].trim())
      const result = AgentActionSchema.safeParse(parsed)
      if (result.success) actions.push(result.data)
    } catch {
      // skip
    }
  }

  for (const match of text.matchAll(inlineJsonRegex)) {
    try {
      const parsed = JSON.parse(match[0])
      const result = AgentActionSchema.safeParse(parsed)
      if (result.success) {
        const isDuplicate = actions.some((a) => JSON.stringify(a) === JSON.stringify(result.data))
        if (!isDuplicate) actions.push(result.data)
      }
    } catch {
      // skip
    }
  }

  return actions
}

export async function executeAction(action: AgentAction, api: typeof edem): Promise<ActionResult> {
  try {
    switch (action.action) {
      case "navigate":
        return { action: "navigate", success: true, data: { path: action.path } }

      case "query_data": {
        const result = await api.data.queryItems({
          collection_id: action.collection,
          filter: action.filter,
        })
        return { action: "query_data", success: true, data: result }
      }

      case "create_item": {
        const result = await api.data.createItem({
          collection_id: action.collection,
          data: action.data,
        })
        return { action: "create_item", success: true, data: result }
      }

      case "update_item": {
        const result = await api.data.updateItem({
          item_id: action.item_id,
          data: action.data,
        })
        return { action: "update_item", success: true, data: result }
      }

      case "delete_item": {
        const result = await api.data.deleteItem({ item_id: action.item_id })
        return { action: "delete_item", success: true, data: result }
      }

      case "run_flow": {
        const result = await api.flows.runFlow({
          flow_id: action.flow_id,
          trigger_data: action.input ?? {},
        })
        return { action: "run_flow", success: true, data: result }
      }

      case "update_setting": {
        const { item } = await api.data.getSingleton({ collection_id: "agent_settings" })
        const current = (item?.data ?? {}) as Record<string, unknown>
        current[action.key] = action.value
        await api.data.updateSingleton({
          collection_id: "agent_settings",
          data: current,
        })
        return {
          action: "update_setting",
          success: true,
          data: { key: action.key, value: action.value },
        }
      }

      default:
        return { action: "unknown", success: false, error: "Unknown action type" }
    }
  } catch (err) {
    return {
      action: action.action,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
