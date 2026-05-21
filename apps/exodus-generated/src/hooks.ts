import { createEdemHooks, createElectrobunHooks, createFlowsHooks } from "@exodus/edem-vue"
import { client } from "./edem-client"
import { edem } from "./edem"
import type { dataManifest } from "./data-manifest"

export const { useCollectionQuery, useCreateItem, useUpdateItem, useDeleteItem, useSingleton } =
  createEdemHooks<typeof dataManifest>(client)

export const { useUpdateStatus, useVersion, useCheckUpdate, useStartUpdate } =
  createElectrobunHooks(edem.electrobun)

export const {
  useFlows,
  useFlow,
  useFlowRuns,
  useRun,
  useRunNodes,
  useCreateFlow,
  useUpdateFlow,
  useDeleteFlow,
  useRunFlow,
  useCancelRun,
  useResumeRun,
  useDeleteRuns,
} = createFlowsHooks(edem.flows)

export { useProjects } from "./composables/useProjects"
export { useIdeas } from "./composables/useIdeas"
export { useProject_flows } from "./composables/useProject_flows"
export { useLogs } from "./composables/useLogs"
export { useApp_state } from "./composables/useApp_state"
