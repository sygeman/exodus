import { createEdemHooks, createElectrobunHooks, createFlowsHooks } from "@exodus/edem-vue"
import { client } from "./edem-client"
import { edem } from "./edem"
import type { dataManifest } from "./data-manifest"

export const {
  useCollectionQuery,
  useSingletonQuery,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
} = createEdemHooks<typeof dataManifest>(client)

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
} = createFlowsHooks(edem.flows)
