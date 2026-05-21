export const dataManifest = {
  collections: [
    {
      id: "projects",
      fields: [
        { name: "name", type: "string", required: true, labels: { en: "Name", ru: "Название" } },
        { name: "slug", type: "string", required: true, labels: { en: "Slug", ru: "Слаг" } },
        { name: "description", type: "text", labels: { en: "Description", ru: "Описание" } },
        { name: "icon", type: "string", labels: { en: "Icon", ru: "Иконка" } },
        { name: "type", type: "string", default: "desktop", labels: { en: "Type", ru: "Тип" } },
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
      id: "project_flows",
      fields: [
        { name: "project_id", type: "uuid", required: true },
        { name: "name", type: "string", required: true },
        { name: "status", type: "string", default: "draft" },
        { name: "kind", type: "string", default: "flow" },
        { name: "nodes", type: "json" },
        { name: "edges", type: "json" },
        { name: "valid", type: "boolean", default: true },
        { name: "validation_errors", type: "json" },
        { name: "meta", type: "json" },
        { name: "manifest_id", type: "string" },
        { name: "backpressure", type: "json" },
      ],
    },
    {
      id: "flows",
      fields: [
        { name: "project_id", type: "uuid" },
        { name: "name", type: "string", required: true },
        { name: "status", type: "string", default: "draft" },
        { name: "kind", type: "string", default: "flow" },
        { name: "nodes", type: "json" },
        { name: "edges", type: "json" },
        { name: "valid", type: "boolean", default: true },
        { name: "validation_errors", type: "json" },
        { name: "meta", type: "json" },
        { name: "manifest_id", type: "string" },
        { name: "backpressure", type: "json" },
      ],
    },
    {
      id: "logs",
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
      singleton: true,
      fields: [
        { name: "last_route", type: "json", labels: { en: "Last Route", ru: "Последний маршрут" } },
        { name: "locale", type: "string", labels: { en: "Locale", ru: "Локаль" } },
        {
          name: "locales",
          type: "json",
          default: [
            { value: "en", label: "English", flag: "🇺🇸" },
            { value: "ru", label: "Русский", flag: "🇷🇺" },
          ],
          labels: { en: "Locales", ru: "Локаля" },
        },
        { name: "dark", type: "boolean", default: false, labels: { en: "Dark", ru: "Тёмная" } },
        { name: "window_frame", type: "json", labels: { en: "Window Frame", ru: "Размер окна" } },
        {
          name: "window_maximized",
          type: "boolean",
          default: false,
          labels: { en: "Maximized", ru: "Развёрнуто" },
        },
      ],
    },
  ],
} as const
