import en from "./en"
import ru from "./ru"

export const messages = { en, ru }

export type Locale = keyof typeof messages
export const defaultLocale: Locale = "en"
export const locales: { value: Locale; label: string; flag: string }[] = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "ru", label: "Русский", flag: "🇷🇺" },
]

export function resolveLocale(systemLocale: string | null): Locale {
  if (!systemLocale) return defaultLocale
  const primary = systemLocale.split("-")[0].toLowerCase() as Locale
  if (primary in messages) return primary
  return defaultLocale
}
