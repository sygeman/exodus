import { useI18n } from "vue-i18n"

export function useT() {
  const { locale } = useI18n()
  return (messages: Record<string, string>, params?: Record<string, unknown>) => {
    const result = messages[locale.value] ?? messages.en ?? Object.values(messages)[0]
    if (!params) return result
    return result.replace(/\{(\w+)\}/g, (_, key: string) =>
      key in params ? String(params[key]) : `{${key}}`,
    )
  }
}
