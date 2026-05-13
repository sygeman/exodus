import { ref, computed } from "vue"

export function useNodeTestMode() {
  return {
    statusColor: ref<string | undefined>(undefined),
    isRunning: computed(() => false),
    isFailed: computed(() => false),
    isCompleted: computed(() => false),
    borderClass: computed(() => ""),
    handleBorderClass: computed(() => ""),
    showErrorTooltip: ref(false),
    getHandleClass: () => "",
    getHandleIconClass: () => "",
  }
}
