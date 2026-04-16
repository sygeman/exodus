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

function mergeMessages(
  base: typeof en,
  overrides: typeof settingsEn,
): typeof en & { settings: typeof settingsEn.settings } {
  return {
    ...base,
    ...overrides,
    common: { ...base.common, ...overrides.common },
    settings: overrides.settings,
  } as typeof en & { settings: typeof settingsEn.settings }
}

export const messages = {
  de: mergeMessages(de, settingsDe),
  en: mergeMessages(en, settingsEn),
  pl: mergeMessages(pl, settingsPl),
  ru: mergeMessages(ru, settingsRu),
  zh: mergeMessages(zh, settingsZh),
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
