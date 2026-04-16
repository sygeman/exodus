import { loggerEvents } from "@/modules/logger/i18n/de"
import { appStateEvents } from "@/modules/app-state/i18n/de"
import { updaterEvents } from "@/modules/updater/i18n/de"
import { schemaEvents } from "@/modules/schema/i18n/de"
import { projectsEvents } from "@/modules/projects/i18n/de"

export default {
  common: {
    darkMode: "Dunkelmodus",
    lightMode: "Hellmodus",
    newProject: "Neues Projekt",
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
    delete: "Löschen",
    save: "Speichern",
  },
  projects: {
    title: "Projekte",
    empty: "Noch keine Projekte",
    create: "Projekt erstellen",
    notFound: "Projekt nicht gefunden",
    backToList: "Zurück zu Projekten",
    settingsTitle: "Projekteinstellungen",
    overview: "Übersicht",
    general: "Allgemein",
    emptyBoard: "Board ist leer",
    emptyBoardDescription: "Projektinhalt wird bald hier erscheinen.",
    name: "Name",
    color: "Farbe",
    nameRequired: "Name ist erforderlich",
    colorRequired: "Farbe ist erforderlich",
  },
  events: {
    title: "Ereignisse",
    logger: loggerEvents,
    "app-state": appStateEvents,
    updater: updaterEvents,
    schema: schemaEvents,
    projects: projectsEvents,
  },
  notFound: {
    title: "Seite nicht gefunden",
    description: "Die gesuchte Seite existiert nicht.",
    backHome: "Zurück zu Projekten",
  },
}
