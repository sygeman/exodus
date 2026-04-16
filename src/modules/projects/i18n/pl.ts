import { projectsEvents } from "./events/pl"

export const projectsMessages = {
  common: {
    newProject: "Nowy projekt",
    save: "Zapisz",
    delete: "Usuń",
  },
  projects: {
    title: "Projekty",
    empty: "Brak projektów",
    create: "Utwórz projekt",
    notFound: "Nie znaleziono projektu",
    backToList: "Wróć do projektów",
    settingsTitle: "Ustawienia projektu",
    overview: "Przegląd",
    general: "Ogólne",
    emptyBoard: "Tablica jest pusta",
    emptyBoardDescription: "Zawartość projektu pojawi się tu wkrótce.",
    name: "Nazwa",
    color: "Kolor",
    nameRequired: "Nazwa jest wymagana",
    colorRequired: "Kolor jest wymagany",
  },
  events: {
    projects: projectsEvents,
  },
}
