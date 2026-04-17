import { projectsEvents } from "./events/de"

export default {
  common: {
    newProject: "Neues Projekt",
    save: "Speichern",
    delete: "Löschen",
    cancel: "Abbrechen",
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
    nameDescription: "Der Projektname wird in der Liste und in der Seitenleiste angezeigt.",
    color: "Farbe",
    colorDescription: "Die Projektfarbe dient zur visuellen Abgrenzung in der Liste.",
    nameRequired: "Name ist erforderlich",
    colorRequired: "Farbe ist erforderlich",
    deleteTitle: "Projekt löschen",
    deleteDescription:
      "Diese Aktion kann nicht rückgängig gemacht werden. Alle Projektdaten werden dauerhaft gelöscht.",
    deleteConfirmTitle: "Projekt löschen?",
    deleteConfirmDescription:
      "Sind Sie sicher, dass Sie dieses Projekt löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.",
  },
  events: {
    projects: projectsEvents,
  },
}
