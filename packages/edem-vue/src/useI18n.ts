import { useI18n as useVueI18n } from "vue-i18n"

export function useI18n() {
  const { locale, t, setLocaleMessage } = useVueI18n()

  function setLocale(lang: string) {
    locale.value = lang
  }

  return { locale, t, setLocale, setLocaleMessage }
}
