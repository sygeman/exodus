import type { Stage, StageInput, StageOutput, OutputFile } from "../ir"

// ── Platform Stage ────────────────────────────────────────────────────────────
// Generates platform-specific code from platform.json features.
// Reads IR.platform.features and generates appropriate files.

export const platformStage: Stage = {
  name: "platform",

  async handle({ ir }: StageInput): Promise<StageOutput> {
    const files: OutputFile[] = []
    const features = ir.platform.features

    // Console logger — patch console methods to write to logs collection
    if (features.consoleLogger) {
      files.push({
        path: "src/platform/logger.ts",
        content: generateLogger(
          features.consoleLogger.collection,
          features.consoleLogger.dedup,
          features.consoleLogger.dedupWindow,
        ),
      })
    }

    // Window persistence — track window frame + system detection
    if (features.windowPersistence || features.systemDetection) {
      files.push({
        path: "src/platform/app-state.ts",
        content: generateAppState(features.windowPersistence, features.systemDetection),
      })
    }

    // Locales data for language settings
    if (ir.components.some((c) => c.name === "SettingsLanguage")) {
      files.push({
        path: "src/platform/locales.ts",
        content: generateLocales(),
      })
    }

    const deps: string[] = []

    return { files, deps }
  },
}

// ── Generators ────────────────────────────────────────────────────────────────

function generateLogger(collectionId: string, dedup: boolean, dedupWindow: number): string {
  return `import type { dataModule } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"

type EdemData = InferModuleAPI<typeof dataModule>

let edemData: EdemData | null = null
${
  dedup
    ? `
// Dedup: repeated warn/error within ${dedupWindow}ms get count++
const pending = new Map<string, { level: string; message: string; source: string; args?: unknown; count: number; timer: ReturnType<typeof setTimeout> }>()

function flush(entry: { level: string; message: string; source: string; args?: unknown }) {
  if (!edemData) return
  edemData.createItem({ collection_id: "${collectionId}", data: { ...entry, source: "bun" } }).catch(() => {})
}

function add(level: string, args: unknown[]) {
  const message = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")
  const key = \`\${level}:\${message}\`

  const existing = pending.get(key)
  if (existing) {
    existing.count++
    clearTimeout(existing.timer)
    existing.timer = setTimeout(() => {
      pending.delete(key)
      flush({ level: existing.level, message: existing.message, source: existing.source, args: existing.args })
    }, ${dedupWindow})
    return
  }

  const timer = setTimeout(() => {
    pending.delete(key)
    flush({ level, message, source: "bun", args: args.length > 1 ? args : undefined })
  }, ${dedupWindow})

  pending.set(key, { level, message, source: "bun", args: args.length > 1 ? args : undefined, count: 1, timer })
}
`
    : `
function add(level: string, args: unknown[]) {
  if (!edemData) return
  const message = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")
  edemData.createItem({ collection_id: "${collectionId}", data: { level, message, source: "bun", args: args.length > 1 ? args : undefined } }).catch(() => {})
}
`
}

class Logger {
  attach(data: EdemData) {
    edemData = data
    this.patchConsole()
  }

  private patchConsole() {
    const original = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    }

    const createHandler =
      (level: "info" | "warn" | "error" | "debug") =>
      (...args: unknown[]) => {
        original[level].apply(console, args)
        add(level, args)
      }

    console.log = createHandler("info")
    console.info = createHandler("info")
    console.warn = createHandler("warn")
    console.error = createHandler("error")
    console.debug = createHandler("debug")
  }
}

export const logger = new Logger()
`
}

function generateAppState(
  windowPersistence?: {
    singleton: string
    fields: string[]
    debounce: number
    minWidth: number
    minHeight: number
  },
  systemDetection?: { singleton: string; fields: string[] },
): string {
  const hasWindow = !!windowPersistence
  const hasSystem = !!systemDetection
  const collectionId = (windowPersistence ?? systemDetection)!.singleton

  return `import { edem } from "@/bun/edem"
${hasSystem ? `import { getSystemLocale, getSystemTheme } from "@exodus/edem-electrobun/system"` : ""}

interface WindowFrame {
  x: number
  y: number
  width: number
  height: number
}

const COLLECTION_ID = "${collectionId}"
${
  hasWindow
    ? `
const MIN_WINDOW_WIDTH = ${windowPersistence!.minWidth}
const MIN_WINDOW_HEIGHT = ${windowPersistence!.minHeight}

export async function persistWindowFrame(
  frame: WindowFrame,
  maximized: boolean,
): Promise<void> {
  if (frame.width < MIN_WINDOW_WIDTH || frame.height < MIN_WINDOW_HEIGHT) return
  await edem.data.updateSingleton({
    collection_id: COLLECTION_ID,
    data: { window_frame: frame, window_maximized: maximized },
  })
}
`
    : ""
}
${
  hasSystem
    ? `
export async function initStateDefaults() {
  const { item } = await edem.data.getSingleton({ collection_id: COLLECTION_ID })
  if (!item) return
  const patch: Record<string, unknown> = {}

  if (!item.data.locale) {
    patch.locale = getSystemLocale()
  }
  if (!item.data.theme) {
    patch.theme = getSystemTheme()
  }

  if (Object.keys(patch).length > 0) {
    await edem.data.updateSingleton({ collection_id: COLLECTION_ID, data: patch })
  }
}
`
    : ""
}
`
}

function generateLocales(): string {
  return `export const locales = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "ru", label: "Russian", flag: "🇷🇺" },
  { value: "de", label: "German", flag: "🇩🇪" },
  { value: "fr", label: "French", flag: "🇫🇷" },
  { value: "ja", label: "Japanese", flag: "🇯🇵" },
]
`
}
