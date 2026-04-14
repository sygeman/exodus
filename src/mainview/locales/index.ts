import en from "./en"
import ru from "./ru"

export const messages = {
  en,
  ru,
}

export type Locale = "en" | "ru"
export const defaultLocale: Locale = "ru"
export const locales: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
]
