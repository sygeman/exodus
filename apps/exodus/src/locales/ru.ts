import { loggerEvents } from "@/modules/logger/i18n/ru"
import { appStateEvents } from "@/modules/app-state/i18n/ru"
import { updaterEvents } from "@/modules/updater/i18n/ru"

export default {
  common: {
    debug: "Отладка",
    settings: "Настройки",
  },
  events: {
    title: "События",
    logger: loggerEvents,
    "app-state": appStateEvents,
    updater: updaterEvents,
  },
  notFound: {
    title: "Страница не найдена",
    description: "Страница, которую вы ищете, не существует.",
    backHome: "Назад к проектам",
  },
}
