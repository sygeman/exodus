<script setup lang="ts">
import { useRouter } from "vue-router"
import { useFlows } from "@/hooks"
import { useT } from "@exodus/edem-vue"

const t = useT()

const router = useRouter()
const { items: flows, loading } = useFlows()

const TRIGGER_LABELS: Record<string, string> = {
  event: "Event",
  schedule: "Schedule",
  manual: "Manual",
  webhook: "Webhook",
}
const STATUS_CLASS: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-500",
  active: "bg-green-500/10 text-green-500",
  paused: "bg-yellow-500/10 text-yellow-500",
  archived: "bg-red-500/10 text-red-500",
}

function goToRuns(flowId: string) {
  router.push(`/debug/flows/${flowId}`)
}
function getNodeCount(flow: { nodes?: unknown[] }): number {
  return Array.isArray(flow.nodes) ? flow.nodes.length : 0
}
function getTriggerType(flow: { trigger?: { type?: string } }): string {
  return flow.trigger?.type || ""
}
function getScheduleLabel(flow: {
  trigger?: { type?: string; every?: string; at?: string; days?: string[] }
}): string {
  if (flow.trigger?.type !== "schedule") return ""
  const parts: string[] = []
  if (flow.trigger.every) parts.push(flow.trigger.every)
  if (flow.trigger.at) parts.push(`at ${flow.trigger.at}`)
  if (flow.trigger.days?.length) parts.push(flow.trigger.days.join(", "))
  return parts.join(" ") || "schedule"
}
</script>

<template>
  <div class="bg-default flex h-full flex-col">
    <div class="border-default flex items-center border-b px-4 py-3">
      <h1 class="text-xl font-bold">{{ t({ en: "Flows", ru: "Флоу" }) }}</h1>
    </div>
    <UScrollArea class="min-h-0 flex-1">
      <div class="flex flex-col gap-2 p-4" v-for="item in flows" :key="item.id">
        <button
          class="border-default hover:bg-elevated flex items-center gap-4 rounded-lg border p-4 text-left transition-colors"
        >
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10"
          >
            <UIcon name="i-lucide-zap" class="h-5 w-5 text-green-500" />
          </div>
          <div class="flex flex-1 flex-col">
            <span class="font-medium">{{ item.name }}</span>
          </div>
        </button>
      </div>
    </UScrollArea>
  </div>
</template>
