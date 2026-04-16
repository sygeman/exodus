import de from "./de"
import en from "./en"
import pl from "./pl"
import ru from "./ru"
import zh from "./zh"
import { settingsMessages as settingsEn } from "@/modules/settings/i18n/en"
import { settingsMessages as settingsDe } from "@/modules/settings/i18n/de"
import { settingsMessages as settingsPl } from "@/modules/settings/i18n/pl"
import { settingsMessages as settingsRu } from "@/modules/settings/i18n/ru"
import { settingsMessages as settingsZh } from "@/modules/settings/i18n/zh"
import { debugMessages as debugEn } from "@/modules/debug/i18n/en"
import { debugMessages as debugDe } from "@/modules/debug/i18n/de"
import { debugMessages as debugPl } from "@/modules/debug/i18n/pl"
import { debugMessages as debugRu } from "@/modules/debug/i18n/ru"
import { debugMessages as debugZh } from "@/modules/debug/i18n/zh"
import { projectsMessages as projectsEn } from "@/modules/projects/i18n/en"
import { projectsMessages as projectsDe } from "@/modules/projects/i18n/de"
import { projectsMessages as projectsPl } from "@/modules/projects/i18n/pl"
import { projectsMessages as projectsRu } from "@/modules/projects/i18n/ru"
import { projectsMessages as projectsZh } from "@/modules/projects/i18n/zh"

function mergeMessages(
  base: typeof en,
  settings: typeof settingsEn,
  debug: typeof debugEn,
  projects: typeof projectsEn,
): typeof en & { settings: typeof settingsEn.settings } {
  return {
    ...base,
    ...settings,
    ...debug,
    ...projects,
    common: { ...base.common, ...settings.common, ...debug.common, ...projects.common },
    settings: settings.settings,
    projects: projects.projects,
    events: { ...base.events, ...projects.events },
  } as typeof en & { settings: typeof settingsEn.settings }
}

export const messages = {
  de: mergeMessages(de, settingsDe, debugDe, projectsDe),
  en: mergeMessages(en, settingsEn, debugEn, projectsEn),
  pl: mergeMessages(pl, settingsPl, debugPl, projectsPl),
  ru: mergeMessages(ru, settingsRu, debugRu, projectsRu),
  zh: mergeMessages(zh, settingsZh, debugZh, projectsZh),
}

export type Locale = "de" | "en" | "pl" | "ru" | "zh"
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
