import type { dataModule, Manifest } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"

type EdemData = InferModuleAPI<typeof dataModule>

const SYSTEM_MANIFEST: Manifest = {
  collections: [
    {
      id: "projects",
      name: "Projects",
      labels: { en: "Projects", ru: "Проекты" },
      fields: [
        { name: "name", type: "string", required: true, labels: { en: "Name", ru: "Название" } },
        { name: "slug", type: "string", required: true, labels: { en: "Slug", ru: "Слаг" } },
        { name: "description", type: "text", labels: { en: "Description", ru: "Описание" } },
        { name: "icon", type: "string", labels: { en: "Icon", ru: "Иконка" } },
        { name: "color", type: "string", labels: { en: "Color", ru: "Цвет" } },
        {
          name: "type",
          type: "string",
          default: "desktop",
          labels: { en: "Type", ru: "Тип" },
        },
        {
          name: "sort_order",
          type: "number",
          default: 0,
          labels: { en: "Sort Order", ru: "Порядок" },
        },
      ],
    },
    {
      id: "ideas",
      name: "Ideas",
      labels: { en: "Ideas", ru: "Идеи" },
      fields: [
        {
          name: "project_id",
          type: "uuid",
          required: true,
          labels: { en: "Project", ru: "Проект" },
        },
        { name: "title", type: "string", required: true, labels: { en: "Title", ru: "Заголовок" } },
        { name: "description", type: "text", labels: { en: "Description", ru: "Описание" } },
        { name: "level", type: "string", labels: { en: "Level", ru: "Уровень" } },
        { name: "type", type: "string", labels: { en: "Type", ru: "Тип" } },
        {
          name: "status",
          type: "string",
          default: "draft",
          labels: { en: "Status", ru: "Статус" },
        },
      ],
    },
    {
      id: "logs",
      name: "Logs",
      labels: { en: "Logs", ru: "Логи" },
      fields: [
        { name: "level", type: "string", required: true, labels: { en: "Level", ru: "Уровень" } },
        {
          name: "message",
          type: "text",
          required: true,
          labels: { en: "Message", ru: "Сообщение" },
        },
        {
          name: "source",
          type: "string",
          required: true,
          labels: { en: "Source", ru: "Источник" },
        },
        { name: "args", type: "json", labels: { en: "Arguments", ru: "Аргументы" } },
        { name: "count", type: "number", labels: { en: "Count", ru: "Количество" } },
      ],
    },
    {
      id: "app_state",
      name: "App State",
      singleton: true,
      labels: { en: "App State", ru: "Состояние приложения" },
      fields: [
        { name: "last_route", type: "json", labels: { en: "Last Route", ru: "Последний маршрут" } },
        { name: "locale", type: "string", labels: { en: "Locale", ru: "Локаль" } },
        { name: "theme", type: "string", labels: { en: "Theme", ru: "Тема" } },
        { name: "window_frame", type: "json", labels: { en: "Window Frame", ru: "Размер окна" } },
        {
          name: "window_maximized",
          type: "boolean",
          default: false,
          labels: { en: "Maximized", ru: "Развёрнуто" },
        },
      ],
    },
    {
      id: "updater_status",
      name: "Updater Status",
      singleton: true,
      labels: { en: "Updater Status", ru: "Статус обновления" },
      fields: [
        {
          name: "status",
          type: "string",
          required: true,
          default: "idle",
          labels: { en: "Status", ru: "Статус" },
        },
        {
          name: "current_version",
          type: "string",
          labels: { en: "Current Version", ru: "Текущая версия" },
        },
        {
          name: "latest_version",
          type: "string",
          labels: { en: "Latest Version", ru: "Последняя версия" },
        },
        { name: "error", type: "string", labels: { en: "Error", ru: "Ошибка" } },
      ],
    },
  ],
}

export async function ensureCollections(data: EdemData): Promise<void> {
  await data.applyManifest({ manifest: SYSTEM_MANIFEST })
}
