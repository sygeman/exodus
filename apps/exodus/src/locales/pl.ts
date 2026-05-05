import { loggerEvents } from "@/modules/logger/i18n/pl"
import { appStateEvents } from "@/modules/app-state/i18n/pl"
import { updaterEvents } from "@/modules/updater/i18n/pl"

export default {
  common: {
    debug: "Debug",
    settings: "Ustawienia",
  },
  events: {
    title: "Zdarzenia",
    logger: loggerEvents,
    "app-state": appStateEvents,
    updater: updaterEvents,
  },
  notFound: {
    title: "Nie znaleziono strony",
    description: "Strona, której szukasz, nie istnieje.",
    backHome: "Wróć do projektów",
  },
}
