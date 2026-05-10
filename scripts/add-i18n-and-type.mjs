import { readFileSync, writeFileSync, globSync } from "node:fs"

// Translation mappings: old string → { en, ru }
const TRANSLATIONS = {
  Settings: { en: "Settings", ru: "Настройки" },
  Debug: { en: "Debug", ru: "Отладка" },
  Logs: { en: "Logs", ru: "Логи" },
  Paused: { en: "Paused", ru: "Приостановлено" },
  Resume: { en: "Resume", ru: "Продолжить" },
  Clear: { en: "Clear", ru: "Очистить" },
  "Search logs...": { en: "Search logs...", ru: "Поиск по логам..." },
  State: { en: "State", ru: "Состояние" },
  Refresh: { en: "Refresh", ru: "Обновить" },
  "New project": { en: "New project", ru: "Новый проект" },
  "Delete project": { en: "Delete project", ru: "Удалить проект" },
  "Are you sure you want to delete this project? This action cannot be undone.": {
    en: "Are you sure you want to delete this project? This action cannot be undone.",
    ru: "Вы уверены, что хотите удалить этот проект? Это действие нельзя отменить.",
  },
  Cancel: { en: "Cancel", ru: "Отмена" },
  Delete: { en: "Delete", ru: "Удалить" },
  "No projects yet": { en: "No projects yet", ru: "Пока нет проектов" },
  "Create project": { en: "Create project", ru: "Создать проект" },
  Projects: { en: "Projects", ru: "Проекты" },
  "Project not found": { en: "Project not found", ru: "Проект не найден" },
  "Back to list": { en: "Back to list", ru: "Назад к списку" },
  Name: { en: "Name", ru: "Название" },
  "Display name of the project": {
    en: "Display name of the project",
    ru: "Отображаемое название проекта",
  },
  Color: { en: "Color", ru: "Цвет" },
  "Project color for sidebar": {
    en: "Project color for sidebar",
    ru: "Цвет проекта для боковой панели",
  },
  "Permanently delete this project and all its ideas.": {
    en: "Permanently delete this project and all its ideas.",
    ru: "Безвозвратно удалить этот проект и все его идеи.",
  },
  Ideas: { en: "Ideas", ru: "Идеи" },
  "Recent Ideas": { en: "Recent Ideas", ru: "Последние идеи" },
  Overview: { en: "Overview", ru: "Обзор" },
  "New Idea": { en: "New Idea", ru: "Новая идея" },
  "No ideas yet": { en: "No ideas yet", ru: "Пока нет идей" },
  "Create first idea": { en: "Create first idea", ru: "Создать первую идею" },
  "Page not found": { en: "Page not found", ru: "Страница не найдена" },
  "The page you're looking for doesn't exist.": {
    en: "The page you're looking for doesn't exist.",
    ru: "Запрашиваемая страница не существует.",
  },
  "Go to projects": { en: "Go to projects", ru: "Перейти к проектам" },
  "Idea not found": { en: "Idea not found", ru: "Идея не найдена" },
  "Back to ideas": { en: "Back to ideas", ru: "Назад к идеям" },
  "Describe this idea...": { en: "Describe this idea...", ru: "Опишите эту идею..." },
  Level: { en: "Level", ru: "Уровень" },
  Type: { en: "Type", ru: "Тип" },
  Status: { en: "Status", ru: "Статус" },
  "Dark Mode": { en: "Dark Mode", ru: "Тёмная тема" },
  "Toggle dark mode appearance": {
    en: "Toggle dark mode appearance",
    ru: "Переключить тёмный режим",
  },
  Language: { en: "Language", ru: "Язык" },
  "Select your preferred language": {
    en: "Select your preferred language",
    ru: "Выберите предпочтительный язык",
  },
  "Updating...": { en: "Updating...", ru: "Обновление..." },
}

// Route param replacements
const PARAM_REPLACEMENTS = [
  [/\{\{\s*projectId\s*\}\}/g, "{{ id }}"],
  [/\/project\/\{\{\s*projectId\s*\}\}\//g, "/project/{{ id }}/"],
]

function addTranslationType(obj) {
  if (typeof obj !== "object" || obj === null) return obj
  if (Array.isArray(obj)) return obj.map(addTranslationType)

  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && value in TRANSLATIONS) {
      const t = TRANSLATIONS[value]
      result[key] = { $type: "translation", en: t.en, ru: t.ru }
    } else if (typeof value === "string") {
      let replaced = value
      for (const [pattern, replacement] of PARAM_REPLACEMENTS) {
        replaced = replaced.replace(pattern, replacement)
      }
      result[key] = replaced
    } else {
      result[key] = addTranslationType(value)
    }
  }
  return result
}

const dirs = [
  "packages/edem-codegen/src/__mocks__/components",
  "apps/exodus-generated/edem-manifests/components",
]

let totalFiles = 0
let totalTranslations = 0

for (const dir of dirs) {
  const files = globSync(`${dir}/*.json`)
  for (const file of files) {
    const content = JSON.parse(readFileSync(file, "utf-8"))
    const updated = addTranslationType(content)

    const after = JSON.stringify(updated)
    const matches = (after.match(/\$type/g) || []).length
    totalTranslations += matches

    writeFileSync(file, JSON.stringify(updated, null, 2) + "\n")
    totalFiles++
    console.log(`${file}: ${matches} translation(s)`)
  }
}

console.log(`\nDone: ${totalFiles} files, ${totalTranslations} translations`)
