import de from "./de"
import en from "./en"
import pl from "./pl"
import ru from "./ru"

export const messages = {
  de,
  en,
  pl,
  ru,
}

export type Locale = "de" | "en" | "pl" | "ru"
export const defaultLocale: Locale = "ru"
export const locales: { value: Locale; label: string; flag: string }[] = [
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "pl", label: "Polski", flag: "🇵🇱" },
  { value: "ru", label: "Русский", flag: "🇷🇺" },
]
