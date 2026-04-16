import de from "./de"
import en from "./en"
import pl from "./pl"
import ru from "./ru"
import zh from "./zh"

export const messages = {
  de,
  en,
  pl,
  ru,
  zh,
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
