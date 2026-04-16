import { projectsEvents } from "./events/ru"

export const projectsMessages = {
  common: {
    newProject: "Новый проект",
    save: "Сохранить",
    delete: "Удалить",
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
    projects: projectsEvents,
  },
}
