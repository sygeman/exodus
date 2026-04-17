import { projectsEvents } from "./events/ru"

export default {
  common: {
    newProject: "Новый проект",
    save: "Сохранить",
    delete: "Удалить",
    cancel: "Отмена",
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
    nameDescription: "Название проекта отображается в списке и боковом меню.",
    color: "Цвет",
    colorDescription: "Цвет проекта используется для визуального выделения в списке.",
    nameRequired: "Название обязательно",
    colorRequired: "Цвет обязателен",
    deleteTitle: "Удаление проекта",
    deleteDescription:
      "Это действие нельзя отменить. Все данные проекта будут безвозвратно удалены.",
    deleteConfirmTitle: "Удалить проект?",
    deleteConfirmDescription:
      "Вы уверены, что хотите удалить этот проект? Это действие необратимо.",
  },
  events: {
    projects: projectsEvents,
  },
}
