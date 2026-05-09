// ── Module ────────────────────────────────────────────────────────────────────

export { codegenModule } from "./module"

// ── Loader ────────────────────────────────────────────────────────────────────

export { loadManifests } from "./load"

// ── Core ──────────────────────────────────────────────────────────────────────

export type {
  IR,
  IRProject,
  IRComponent,
  IRRoute,
  IRCollection,
  IRField,
  IRFlow,
  IRFlowTrigger,
  IRFlowNode,
  IRFlowEdge,
  OutputFile,
  Stage,
  StageInput,
  StageOutput,
} from "./ir"

export { parseManifests, type Manifests } from "./parse"
export { validateIR, type ValidationError } from "./validate"

// ── Stages ────────────────────────────────────────────────────────────────────

export { bunStage } from "./stages/bun"
export { electrobunStage } from "./stages/electrobun"
export { vueStage } from "./stages/vue"
export { dataStage } from "./stages/data"
export { flowsStage } from "./stages/flows"
export { appStage } from "./stages/app"

// ── Re-exports from edem-ui ───────────────────────────────────────────────────

export type { ComponentNode, EventBinding, DataBinding, Route, UIManifest } from "@exodus/edem-ui"
