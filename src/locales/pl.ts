import { loggerEvents } from "@/modules/logger/i18n/pl"
import { appStateEvents } from "@/modules/app-state/i18n/pl"
import { updaterEvents } from "@/modules/updater/i18n/pl"
import { schemaEvents } from "@/modules/schema/i18n/pl"

export default {
  common: {
    darkMode: "Tryb ciemny",
    lightMode: "Tryb jasny",
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
  },
  events: {
    title: "Zdarzenia",
    logger: loggerEvents,
    "app-state": appStateEvents,
    updater: updaterEvents,
    schema: schemaEvents,
  },
  notFound: {
    title: "Nie znaleziono strony",
    description: "Strona, której szukasz, nie istnieje.",
    backHome: "Wróć do projektów",
  },
}
