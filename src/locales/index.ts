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

function mergeMessages(
  base: typeof en,
  settings: typeof settingsEn,
  debug: typeof debugEn,
): typeof en & { settings: typeof settingsEn.settings } {
  return {
    ...base,
    ...settings,
    ...debug,
    common: { ...base.common, ...settings.common, ...debug.common },
    settings: settings.settings,
  } as typeof en & { settings: typeof settingsEn.settings }
}

export const messages = {
  de: mergeMessages(de, settingsDe, debugDe),
  en: mergeMessages(en, settingsEn, debugEn),
  pl: mergeMessages(pl, settingsPl, debugPl),
  ru: mergeMessages(ru, settingsRu, debugRu),
  zh: mergeMessages(zh, settingsZh, debugZh),
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
