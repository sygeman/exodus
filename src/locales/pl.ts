import { loggerEvents } from "@/modules/logger/i18n/pl"
import { appStateEvents } from "@/modules/app-state/i18n/pl"
import { updaterEvents } from "@/modules/updater/i18n/pl"
import { schemaEvents } from "@/modules/schema/i18n/pl"
import { projectsEvents } from "@/modules/projects/i18n/pl"

export default {
  common: {
    darkMode: "Tryb ciemny",
    lightMode: "Tryb jasny",
    newProject: "Nowy projekt",
    back: "Wstecz",
    close: "Zamknij",
    search: "Szukaj",
    details: "Szczegóły",
    debug: "Debug",
    update: "Aktualizacja",
    check: "Sprawdź",
    install: "Zainstaluj",
    updateAvailable: "Dostępna aktualizacja",
    upToDate: "Aktualna wersja",
    updateError: "Błąd",
    checking: "Sprawdzanie...",
    downloading: "Pobieranie...",
    applying: "Instalowanie...",
    updateAvailableTitle: "Dostępna aktualizacja",
    updateAvailableDescription: "{current} → {latest}",
    updateNow: "Zaktualizuj",
    updateLater: "Później",
    delete: "Usuń",
    save: "Zapisz",
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
    title: "Zdarzenia",
    logger: loggerEvents,
    "app-state": appStateEvents,
    updater: updaterEvents,
    schema: schemaEvents,
    projects: projectsEvents,
  },
  notFound: {
    title: "Nie znaleziono strony",
    description: "Strona, której szukasz, nie istnieje.",
    backHome: "Wróć do projektów",
  },
}
