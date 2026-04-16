import { projectsEvents } from "./events/de"

export const projectsMessages = {
  common: {
    newProject: "Neues Projekt",
    save: "Speichern",
    delete: "Löschen",
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
    projects: projectsEvents,
  },
}
