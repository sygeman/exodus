import en from "./en"
import pl from "./pl"
import ru from "./ru"

export const messages = {
  en,
  pl,
  ru,
}

export type Locale = "en" | "pl" | "ru"
export const defaultLocale: Locale = "ru"
export const locales: { value: Locale; label: string; flag: string }[] = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "pl", label: "Polski", flag: "🇵🇱" },
  { value: "ru", label: "Русский", flag: "🇷🇺" },
]
