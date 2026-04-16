import { loggerEvents } from "@/modules/logger/i18n/ru"
import { appStateEvents } from "@/modules/app-state/i18n/ru"
import { updaterEvents } from "@/modules/updater/i18n/ru"
import { schemaEvents } from "@/modules/schema/i18n/ru"

export default {
  common: {
    darkMode: "Тёмная тема",
    lightMode: "Светлая тема",
    back: "Назад",
    close: "Закрыть",
    search: "Поиск",
    details: "Детали",
    debug: "Отладка",
    update: "Обновление",
    check: "Проверить",
    install: "Обновить",
    updateAvailable: "Доступно обновление",
    upToDate: "Актуальная версия",
    updateError: "Ошибка",
    checking: "Проверка...",
    downloading: "Загрузка...",
    applying: "Установка...",
    updateAvailableTitle: "Доступно обновление",
    updateAvailableDescription: "{current} → {latest}",
    updateNow: "Обновить",
    updateLater: "Позже",
  },
  events: {
    title: "События",
    logger: loggerEvents,
    "app-state": appStateEvents,
    updater: updaterEvents,
    schema: schemaEvents,
  },
  notFound: {
    title: "Страница не найдена",
    description: "Страница, которую вы ищете, не существует.",
    backHome: "Назад к проектам",
  },
}
