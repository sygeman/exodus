import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"

export type ModalName = "events" | "logs"

export function useModalRoute() {
  const route = useRoute()
  const router = useRouter()

  const openModals = computed<ModalName[]>(() => {
    const raw = route.query.modal
    if (Array.isArray(raw)) {
      return raw.filter((m): m is ModalName => m === "events" || m === "logs")
    }
    if (raw === "events" || raw === "logs") return [raw]
    return []
  })

  const isEventsOpen = computed(() => openModals.value.includes("events"))
  const isLogsOpen = computed(() => openModals.value.includes("logs"))

  function openModal(name: ModalName) {
    if (openModals.value.includes(name)) return
    const modal = [...openModals.value, name]
    router.push({ query: { ...route.query, modal } })
  }

  function closeModal(name: ModalName) {
    const modal = openModals.value.filter((m) => m !== name)
    const query = { ...route.query }
    if (modal.length) {
      query.modal = modal
    } else {
      delete query.modal
    }
    router.replace({ query })
  }

  return {
    openModals,
    isEventsOpen,
    isLogsOpen,
    openModal,
    closeModal,
  }
}
