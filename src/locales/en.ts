import { loggerEvents } from "@/modules/logger/i18n/en"
import { appStateEvents } from "@/modules/app-state/i18n/en"
import { updaterEvents } from "@/modules/updater/i18n/en"
import { schemaEvents } from "@/modules/schema/i18n/en"
import { projectsEvents } from "@/modules/projects/i18n/en"

export default {
  common: {
    darkMode: "Dark mode",
    lightMode: "Light mode",
    newProject: "New Project",
    back: "Back",
    close: "Close",
    search: "Search",
    details: "Details",
    debug: "Debug",
    update: "Update",
    check: "Check",
    install: "Install",
    updateAvailable: "Update available",
    upToDate: "Up to date",
    updateError: "Error",
    checking: "Checking...",
    downloading: "Downloading...",
    applying: "Applying...",
    updateAvailableTitle: "Update available",
    updateAvailableDescription: "{current} → {latest}",
    updateNow: "Update now",
    updateLater: "Later",
    delete: "Delete",
    save: "Save",
  },

  projects: {
    title: "Projects",
    empty: "No projects yet",
    create: "Create project",
    notFound: "Project not found",
    backToList: "Back to projects",
    settingsTitle: "Project Settings",
    overview: "Overview",
    general: "General",
    emptyBoard: "Board is empty",
    emptyBoardDescription: "Project content will appear here soon.",
    name: "Name",
    color: "Color",
    nameRequired: "Name is required",
    colorRequired: "Color is required",
  },
  events: {
    title: "Events",
    logger: loggerEvents,
    "app-state": appStateEvents,
    updater: updaterEvents,
    schema: schemaEvents,
    projects: projectsEvents,
  },
  notFound: {
    title: "Page not found",
    description: "The page you're looking for doesn't exist.",
    backHome: "Back to projects",
  },
}
