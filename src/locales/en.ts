import { loggerEvents } from "@/modules/logger/i18n/en"
import { appStateEvents } from "@/modules/app-state/i18n/en"
import { updaterEvents } from "@/modules/updater/i18n/en"
import { schemaEvents } from "@/modules/schema/i18n/en"

export default {
  common: {
    darkMode: "Dark mode",
    lightMode: "Light mode",
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
  },
  events: {
    title: "Events",
    logger: loggerEvents,
    "app-state": appStateEvents,
    updater: updaterEvents,
    schema: schemaEvents,
  },
  notFound: {
    title: "Page not found",
    description: "The page you're looking for doesn't exist.",
    backHome: "Back to projects",
  },
}
