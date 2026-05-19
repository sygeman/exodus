import type { Ref, Component, VNode } from "vue"
import type { RouteLocationNormalizedLoaded, Router } from "vue-router"
import type { ComponentNode, ManifestQuery } from "../../../../packages/edem-ui/src"
import type { edem } from "@/edem"

export type ScreenComponentRegistry = Record<string, Component | string>

export interface LogicFlowDefinition {
  id: string
  profile: "ui-action" | "domain" | "system"
  runtime: "client" | "server" | "either"
  trigger?: {
    type: "ui-event" | "manual" | "event" | "schedule" | "webhook"
    event?: string
  }
  nodes: LogicFlowNode[]
  edges?: LogicFlowEdge[]
}

export type LogicFlowNode =
  | { id: string; type: "trigger"; data?: Record<string, unknown> }
  | { id: string; type: "guard"; data: { condition: string; unless?: boolean } }
  | { id: string; type: "ui:set-state"; data: { state: string; value: unknown } }
  | {
      id: string
      type: "ui:set-timeout-state"
      data: { state: string; value: unknown; delay: number }
    }
  | { id: string; type: "ui:navigate"; data: { to: string } }
  | { id: string; type: "ui:clipboard-write"; data: { text: string } }
  | {
      id: string
      type: "ui:event"
      data: { stopPropagation?: boolean; preventDefault?: boolean }
    }
  | {
      id: string
      type: "data:create-item"
      data: { collection: string; data?: Record<string, unknown>; assignTo?: string }
    }
  | {
      id: string
      type: "data:update-item"
      data: { collection: string; id: string; data: Record<string, unknown> }
    }
  | { id: string; type: "data:delete-item"; data: { collection: string; id: string } }
  | {
      id: string
      type: "data:update-singleton"
      data: { collection: string; data: Record<string, unknown> }
    }
  | {
      id: string
      type: "domain:invoke"
      data: { flow: string; input?: Record<string, unknown> }
    }
  | { id: string; type: "output"; data?: { value?: unknown } }

export interface LogicFlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
}

export interface ScreenManifestDefinition {
  id: string
  root: ComponentNode
  queries?: Record<string, ManifestQuery>
  constants?: Record<string, unknown>
  state?: Record<string, unknown>
  computed?: Record<string, string>
  flows?: Record<string, LogicFlowDefinition>
}

export interface ScreenRuntimeContext {
  route: RouteLocationNormalizedLoaded
  router: Router
  edem: typeof edem
  state: Record<string, Ref<unknown>>
  queries: Record<string, Ref<unknown>>
  props?: Record<string, unknown>
  helpers?: Record<string, (...args: unknown[]) => unknown>
}

export interface LogicTriggerContext {
  event?: unknown
  item?: unknown
  route: RouteLocationNormalizedLoaded
  props?: Record<string, unknown>
}

export interface LogicRunInput {
  flow: LogicFlowDefinition
  trigger: LogicTriggerContext
  context: ScreenRuntimeContext
}

export type LogicEffect =
  | { type: "ui:set-state"; state: string; value: unknown }
  | { type: "ui:set-timeout-state"; state: string; value: unknown; delay: number }
  | { type: "ui:navigate"; to: string }
  | { type: "ui:clipboard-write"; text: string }
  | { type: "ui:event"; stopPropagation?: boolean; preventDefault?: boolean }

export interface LogicRunResult {
  status: "completed" | "waiting" | "error"
  output?: unknown
  effects: LogicEffect[]
  error?: string
}

export interface UseLogicFlowInput {
  flows: Record<string, LogicFlowDefinition>
  context: ScreenRuntimeContext
}

export interface UseLogicFlowResult {
  run: (input: LogicRunInput) => Promise<LogicRunResult>
  handlers: Record<string, (event?: unknown, item?: unknown) => Promise<void>>
  pending: Ref<boolean>
  error: Ref<string | null>
}

export interface UseScreenRuntimeInput {
  screen: ScreenManifestDefinition
  flows: Record<string, LogicFlowDefinition>
  registry: ScreenComponentRegistry
  context: Omit<ScreenRuntimeContext, "state" | "queries">
}

export interface UseScreenRuntimeResult {
  registry: ScreenComponentRegistry
  state: Record<string, Ref<unknown>>
  queries: Record<string, Ref<unknown>>
  handlers: Record<string, (event?: unknown, item?: unknown) => Promise<void>>
  renderRoot: () => VNode | null
}
