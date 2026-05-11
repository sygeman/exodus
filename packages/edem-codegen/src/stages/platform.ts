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

    // Updater — checkUpdate + startUpdate via Electrobun Updater
    if (features.updater) {
      files.push({
        path: "src/platform/updater.ts",
        content: generateUpdater(features.updater.checkInterval),
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
    if (features.updater) {
      deps.push("zod")
    }

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

  return `import type { BrowserWindow } from "electrobun/bun"
import type { dataModule } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"

type EdemData = InferModuleAPI<typeof dataModule>

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

let stateItemId: string | null = null

async function ensureAppStateItem(data: EdemData): Promise<string> {
  if (stateItemId) return stateItemId
  const { items } = await data.queryItems({ collection_id: COLLECTION_ID })
  if (items.length > 0 && items[0].id) {
    stateItemId = items[0].id
    return stateItemId
  }
  const { id } = await data.createItem({
    collection_id: COLLECTION_ID,
    data: {
      window_frame: null,
      window_maximized: false,
    },
  })
  stateItemId = id
  return id
}

export async function persistWindowFrame(
  data: EdemData,
  frame: WindowFrame,
  maximized?: boolean,
): Promise<void> {
  if (frame.width < MIN_WINDOW_WIDTH || frame.height < MIN_WINDOW_HEIGHT) return
  const id = await ensureAppStateItem(data)
  const patch: Record<string, unknown> = { window_frame: frame }
  if (maximized !== undefined) patch.window_maximized = maximized
  await data.updateItem({ item_id: id, data: patch })
}

export async function persistRoute(data: EdemData, hash?: string): Promise<void> {
  if (!hash) return
  const id = await ensureAppStateItem(data)
  await data.updateItem({ item_id: id, data: { last_route: { hash } } })
}

const ALLOWED_SETTING_KEYS = new Set(["theme", "locale"])

export async function persistSetting(
  data: EdemData,
  key: string,
  value: unknown,
): Promise<void> {
  if (!key || !ALLOWED_SETTING_KEYS.has(key)) return
  const id = await ensureAppStateItem(data)
  await data.updateItem({ item_id: id, data: { [key]: value } })
}
`
    : ""
}
${
  hasSystem
    ? `
function getSystemLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    return "en-US"
  }
}

function getSystemTheme(): "dark" | "light" {
  if (process.platform === "darwin") {
    try {
      const { execSync } = require("child_process")
      const style = execSync("defaults read -g AppleInterfaceStyle", { encoding: "utf-8" }).trim()
      return style === "Dark" ? "dark" : "light"
    } catch {
      return "light"
    }
  }

  if (process.platform === "win32") {
    try {
      const { execSync } = require("child_process")
      const result = execSync(
        'reg query "HKEY_CURRENT_USER\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Themes\\\\Personalize" /v AppsUseLightTheme',
        { encoding: "utf-8" },
      )
      return result.includes("0x0") ? "dark" : "light"
    } catch {
      return "light"
    }
  }

  if (process.platform === "linux") {
    try {
      const { execSync } = require("child_process")
      const theme = execSync("gsettings get org.gnome.desktop.interface gtk-theme", {
        encoding: "utf-8",
      }).trim()
      return theme.toLowerCase().includes("dark") ? "dark" : "light"
    } catch {
      return "light"
    }
  }

  return "light"
}

export async function initStateDefaults(data: EdemData) {
  const { items } = await data.queryItems({ collection_id: COLLECTION_ID })
  if (items.length === 0) return
  const item = items[0]
  const patch: Record<string, unknown> = {}

  if (!item.data.locale) {
    patch.locale = getSystemLocale()
  }
  if (!item.data.theme) {
    patch.theme = getSystemTheme()
  }

  if (Object.keys(patch).length > 0) {
    await data.updateItem({ item_id: item.id, data: patch })
  }
}
`
    : ""
}
${
  hasWindow
    ? `
export function initAppState(
  win: BrowserWindow,
  saveFrame?: (data: { frame: WindowFrame; maximized?: boolean }) => void,
) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function debouncedSaveFrame(frame: WindowFrame) {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      saveFrame?.({ frame })
    }, ${windowPersistence!.debounce})
  }

  win.on("resize", (event: unknown) => {
    const e = event as { data?: { x: number; y: number; width: number; height: number } }
    if (e.data) {
      debouncedSaveFrame(e.data)
    }
  })

  win.on("move", () => {
    const currentFrame = win.getFrame()
    debouncedSaveFrame(currentFrame)
  })

  win.on("close", () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    const currentFrame = win.getFrame()
    saveFrame?.({ frame: currentFrame, maximized: win.isMaximized() })
  })
}
`
    : ""
}
`
}

function generateUpdater(_checkInterval: string): string {
  return `import { Updater } from "electrobun/bun"
import type { dataModule } from "@exodus/edem-data"
import { createEdemModule, type InferModuleAPI } from "@exodus/edem-core"
import { z } from "zod"

type EdemData = InferModuleAPI<typeof dataModule>

const COLLECTION_ID = "updater_status"

let dataRef: EdemData | null = null
let statusItemId: string | null = null

async function ensureStatusItem(data: EdemData): Promise<string> {
  if (statusItemId) return statusItemId
  const { items } = await data.queryItems({ collection_id: COLLECTION_ID })
  if (items.length > 0) {
    statusItemId = items[0].id
    return statusItemId
  }
  const { id } = await data.createItem({
    collection_id: COLLECTION_ID,
    data: { status: "idle" },
  })
  statusItemId = id
  return id
}

async function sendStatus(
  data: EdemData,
  payload: {
    status: "idle" | "checking" | "available" | "latest" | "error" | "downloading" | "applying"
    current_version?: string
    latest_version?: string
    error?: string
  },
) {
  const id = await ensureStatusItem(data)
  await data.updateItem({ item_id: id, data: payload })
}

async function checkForUpdate() {
  if (!dataRef) return
  try {
    await sendStatus(dataRef, { status: "checking" })
    const result = await Updater.checkForUpdate()
    const currentVersion = await Updater.localInfo.version()
    const currentHash = await Updater.localInfo.hash()

    const isActuallyAvailable =
      result.updateAvailable && result.version !== currentVersion && result.hash !== currentHash

    if (result.error) {
      await sendStatus(dataRef, { status: "error", error: result.error })
    } else if (isActuallyAvailable) {
      await sendStatus(dataRef, {
        status: "available",
        current_version: currentVersion,
        latest_version: result.version,
      })
    } else {
      await sendStatus(dataRef, { status: "latest", current_version: currentVersion })
    }
  } catch (err) {
    console.error("[updater] checkUpdate error:", err)
    await sendStatus(dataRef, {
      status: "error",
      error: (err as Error).message || String(err),
    })
  }
}

async function startUpdate() {
  if (!dataRef) return
  try {
    await sendStatus(dataRef, { status: "downloading" })
    await Updater.downloadUpdate()
    await sendStatus(dataRef, { status: "applying" })
    await Updater.applyUpdate()
  } catch (err) {
    console.error("[updater] update failed:", err)
    await sendStatus(dataRef, {
      status: "error",
      error: (err as Error).message || String(err),
    })
  }
}

export const updaterModule = createEdemModule(
  "updater",
  (module) =>
    module
      .mutation("checkUpdate", {
        input: z.object({}),
        output: z.object({ status: z.string() }),
        resolve: async () => {
          await checkForUpdate()
          return { status: "ok" }
        },
      })
      .mutation("startUpdate", {
        input: z.object({}),
        output: z.object({ status: z.string() }),
        resolve: async () => {
          await startUpdate()
          return { status: "ok" }
        },
      }),
  (edem) => {
    const { data } = edem as { data: EdemData }
    dataRef = data
    ensureStatusItem(data).then(() => checkForUpdate())
  },
)
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
