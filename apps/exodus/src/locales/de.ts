import { loggerEvents } from "@/modules/logger/i18n/de"
import { appStateEvents } from "@/modules/app-state/i18n/de"
import { updaterEvents } from "@/modules/updater/i18n/de"
import { schemaEvents } from "@/modules/schema/i18n/de"

export default {
  common: {
    debug: "Debug",
    settings: "Einstellungen",
  },
  events: {
    title: "Ereignisse",
    logger: loggerEvents,
    "app-state": appStateEvents,
    updater: updaterEvents,
    schema: schemaEvents,
  },
  notFound: {
    title: "Seite nicht gefunden",
    description: "Die gesuchte Seite existiert nicht.",
    backHome: "Zurück zu Projekten",
  },
}
