import { loggerEvents } from "@/modules/logger/i18n/ru"
import { appStateEvents } from "@/modules/app-state/i18n/ru"
import { updaterEvents } from "@/modules/updater/i18n/ru"
import { schemaEvents } from "@/modules/schema/i18n/ru"
import { projectsEvents } from "@/modules/projects/i18n/ru"

export default {
  common: {
    darkMode: "Тёмная тема",
    lightMode: "Светлая тема",
    newProject: "Новый проект",
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
    delete: "Удалить",
    save: "Сохранить",
  },
  projects: {
    title: "Проекты",
    empty: "Пока нет проектов",
    create: "Создать проект",
    notFound: "Проект не найден",
    backToList: "Назад к проектам",
    settingsTitle: "Настройки проекта",
    overview: "Обзор",
    general: "Общие",
    emptyBoard: "Доска пуста",
    emptyBoardDescription: "Содержимое проекта появится здесь позже.",
    name: "Название",
    color: "Цвет",
    nameRequired: "Название обязательно",
    colorRequired: "Цвет обязателен",
  },
  events: {
    title: "События",
    logger: loggerEvents,
    "app-state": appStateEvents,
    updater: updaterEvents,
    schema: schemaEvents,
    projects: projectsEvents,
  },
  notFound: {
    title: "Страница не найдена",
    description: "Страница, которую вы ищете, не существует.",
    backHome: "Назад к проектам",
  },
}
