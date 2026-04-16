import { loggerEvents } from "@/modules/logger/i18n/de"
import { appStateEvents } from "@/modules/app-state/i18n/de"
import { updaterEvents } from "@/modules/updater/i18n/de"
import { schemaEvents } from "@/modules/schema/i18n/de"

export default {
  common: {
    darkMode: "Dunkelmodus",
    lightMode: "Hellmodus",
    back: "Zurück",
    close: "Schließen",
    search: "Suchen",
    details: "Details",
    debug: "Debug",
    update: "Update",
    check: "Prüfen",
    install: "Installieren",
    updateAvailable: "Update verfügbar",
    upToDate: "Aktuell",
    updateError: "Fehler",
    checking: "Prüfung läuft...",
    downloading: "Herunterladen...",
    applying: "Anwenden...",
    updateAvailableTitle: "Update verfügbar",
    updateAvailableDescription: "{current} → {latest}",
    updateNow: "Jetzt aktualisieren",
    updateLater: "Später",
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
