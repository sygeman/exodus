import { projectsEvents } from "./events/pl"

export default {
  common: {
    newProject: "Nowy projekt",
    save: "Zapisz",
    delete: "Usuń",
    cancel: "Anuluj",
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
    nameDescription: "Nazwa projektu jest wyświetlana na liście i w panelu bocznym.",
    color: "Kolor",
    colorDescription: "Kolor projektu służy do wizualnego wyróżnienia na liście.",
    nameRequired: "Nazwa jest wymagana",
    colorRequired: "Kolor jest wymagany",
    deleteTitle: "Usuń projekt",
    deleteDescription:
      "Tej akcji nie można cofnąć. Wszystkie dane projektu zostaną trwale usunięte.",
    deleteConfirmTitle: "Usunąć projekt?",
    deleteConfirmDescription: "Czy na pewno chcesz usunąć ten projekt? Tej akcji nie można cofnąć.",
  },
  events: {
    projects: projectsEvents,
  },
}
