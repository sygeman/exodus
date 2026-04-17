import { loggerEvents } from "@/modules/logger/i18n/en"
import { appStateEvents } from "@/modules/app-state/i18n/en"
import { updaterEvents } from "@/modules/updater/i18n/en"
import { schemaEvents } from "@/modules/schema/i18n/en"

export default {
  common: {
    debug: "Debug",
    settings: "Settings",
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
