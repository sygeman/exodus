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
import { updaterMessages as updaterEn } from "@/modules/updater/i18n/en"
import { updaterMessages as updaterDe } from "@/modules/updater/i18n/de"
import { updaterMessages as updaterPl } from "@/modules/updater/i18n/pl"
import { updaterMessages as updaterRu } from "@/modules/updater/i18n/ru"
import { updaterMessages as updaterZh } from "@/modules/updater/i18n/zh"

type BaseMessages = typeof en
type SettingsMessages = typeof settingsEn
type DebugMessages = typeof debugEn
type ProjectsMessages = typeof projectsEn
type UpdaterMessages = typeof updaterEn

function mergeMessages(
  base: BaseMessages,
  settings: SettingsMessages,
  debug: DebugMessages,
  projects: ProjectsMessages,
  updater: UpdaterMessages,
) {
  return {
    ...base,
    ...settings,
    ...debug,
    ...projects,
    ...updater,
    common: { ...base.common, ...settings.common, ...debug.common, ...projects.common },
    settings: settings.settings,
    projects: projects.projects,
    updater: updater.updater,
    events: { ...base.events, ...projects.events },
  }
}

export const messages = {
  de: mergeMessages(de, settingsDe, debugDe, projectsDe, updaterDe),
  en: mergeMessages(en, settingsEn, debugEn, projectsEn, updaterEn),
  pl: mergeMessages(pl, settingsPl, debugPl, projectsPl, updaterPl),
  ru: mergeMessages(ru, settingsRu, debugRu, projectsRu, updaterRu),
  zh: mergeMessages(zh, settingsZh, debugZh, projectsZh, updaterZh),
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
