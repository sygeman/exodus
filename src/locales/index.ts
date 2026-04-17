import de from "./de"
import en from "./en"
import pl from "./pl"
import ru from "./ru"
import zh from "./zh"
import settings from "@/modules/settings/i18n"
import debug from "@/modules/debug/i18n"
import projects from "@/modules/projects/i18n"
import updater from "@/modules/updater/i18n"

const base = { de, en, pl, ru, zh }

const modules = [settings, debug, projects, updater]

type MessageShape = Record<string, Record<string, unknown>>

function mergeForLocale(locale: keyof typeof base) {
  const baseMessages = base[locale] as MessageShape
  const moduleMessages = modules.map((m) => m[locale] as MessageShape)

  const merged = {
    ...baseMessages,
    ...moduleMessages.reduce((acc, m) => ({ ...acc, ...m }), {}),
    common: moduleMessages.reduce((acc, m) => ({ ...acc, ...m.common }), baseMessages.common),
    events: moduleMessages.reduce((acc, m) => ({ ...acc, ...m.events }), baseMessages.events),
    settings: moduleMessages.find((m) => m.settings)?.settings,
    projects: moduleMessages.find((m) => m.projects)?.projects,
    updater: moduleMessages.find((m) => m.updater)?.updater,
    debug: moduleMessages.find((m) => m.debug)?.debug,
  }

  return Object.fromEntries(
    Object.entries(merged).filter(([, v]) => v !== undefined),
  ) as MessageShape
}

export const messages = {
  de: mergeForLocale("de"),
  en: mergeForLocale("en"),
  pl: mergeForLocale("pl"),
  ru: mergeForLocale("ru"),
  zh: mergeForLocale("zh"),
}

export type Locale = keyof typeof messages
export const defaultLocale: Locale = "en"
export const locales: { value: Locale; label: string; flag: string }[] = [
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "pl", label: "Polski", flag: "🇵🇱" },
  { value: "ru", label: "Русский", flag: "🇷🇺" },
  { value: "zh", label: "简体中文", flag: "🇨🇳" },
]

export function resolveLocale(systemLocale: string | null): Locale {
  if (!systemLocale) return defaultLocale
  const primary = systemLocale.split("-")[0].toLowerCase() as Locale
  if (primary in messages) return primary
  return defaultLocale
}
