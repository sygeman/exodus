import { computed } from "vue"
import type { VueFlowNodeData } from "@/types/flow"

type StatusColor = "success" | "error" | "primary" | "warning" | "info"

const STATUS_COLOR_MAP: Record<string, StatusColor> = {
  completed: "success",
  failed: "error",
  running: "primary",
}

const ICON_COLOR_MAP: Record<string, string> = {
  success: "text-success",
  error: "text-error",
  warning: "text-warning",
  primary: "text-primary",
  info: "text-info",
}

export function useNodeTestMode(data?: () => VueFlowNodeData, selected?: () => boolean) {
  const d = data ? computed(() => data()) : computed(() => ({}) as VueFlowNodeData)
  const isSelected = selected ? computed(() => selected()) : computed(() => false)

  const testMode = computed(() => !!d.value.testMode)

  const statusColor = computed<StatusColor | undefined>(() => {
    if (!d.value.status) return undefined
    return STATUS_COLOR_MAP[d.value.status] ?? undefined
  })

  const isRunning = computed(() => d.value.status === "running")
  const isFailed = computed(() => d.value.status === "failed")
  const isCompleted = computed(() => d.value.status === "completed")

  const borderClass = computed(() => {
    if (isSelected.value) return "!border-primary"
    if (!testMode.value) return ""
    if (isRunning.value) return "!border-primary"
    if (isCompleted.value) return "!border-success"
    if (isFailed.value) return "!border-error"
    return ""
  })

  const handleBorderClass = computed(() => {
    if (!testMode.value) return ""
    if (isRunning.value) return "!border-primary"
    if (isCompleted.value) return "!border-success"
    if (isFailed.value) return "!border-error"
    return ""
  })

  const handleIconClass = computed(() => {
    if (!testMode.value) return ""
    if (isRunning.value) return "text-primary"
    if (isCompleted.value) return "text-success"
    if (isFailed.value) return "text-error"
    return ""
  })

  const showErrorTooltip = computed(() => {
    return testMode.value && isFailed.value && !!d.value.error
  })

  const iconColorClass = computed(() => {
    if (!testMode.value || !statusColor.value) return "text-muted"
    return ICON_COLOR_MAP[statusColor.value] ?? "text-muted"
  })

  function getHandleClass(_handleId: string, _color: string, _isCompleted?: () => boolean): string {
    if (!testMode.value) return ""
    if (isRunning.value) return "!border-primary"
    if (isCompleted.value) return "!border-success"
    if (isFailed.value) return "!border-error"
    return ""
  }

  function getHandleIconClass(
    _handleId: string,
    _color: string,
    _isCompleted?: () => boolean,
  ): string {
    if (!testMode.value) return ""
    if (isRunning.value) return "text-primary"
    if (isCompleted.value) return "text-success"
    if (isFailed.value) return "text-error"
    return ""
  }

  return {
    statusColor,
    isRunning,
    isFailed,
    isCompleted,
    borderClass,
    handleBorderClass,
    handleIconClass,
    showErrorTooltip,
    iconColorClass,
    getHandleClass,
    getHandleIconClass,
  }
}
