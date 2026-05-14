<script setup lang="ts">
import { useRouter } from "vue-router"
import { useT } from "@exodus/edem-vue"
import { useFlows } from "@/hooks"

const t = useT()
const router = useRouter()

const { data: flows, loading } = useFlows()

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
    <!-- Header -->
    <div class="border-default flex items-center border-b px-4 py-3">
      <h1 class="text-xl font-bold">{{ t({ en: "Flows", ru: "Флоу" }) }}</h1>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-1 flex-col gap-2 p-4">
      <div
        v-for="i in 5"
        :key="i"
        class="border-default flex items-center gap-4 rounded-lg border p-4"
      >
        <USkeleton class="h-10 w-10 shrink-0 rounded-lg" />
        <USkeleton class="h-5 w-48" />
      </div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="flows.length === 0"
      class="text-muted flex flex-1 items-center justify-center p-8 text-sm"
    >
      {{ t({ en: "No flows.", ru: "Нет флоу." }) }}
    </div>

    <!-- Flows list -->
    <UScrollArea v-else class="min-h-0 flex-1">
      <div class="flex flex-col gap-2 p-4">
        <button
          v-for="flow in flows"
          :key="flow.id"
          class="border-default hover:bg-elevated flex items-center gap-4 rounded-lg border p-4 text-left transition-colors"
          @click="goToRuns(flow.id)"
        >
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-sm"
          >
            ⚡
          </div>
          <div class="flex flex-1 flex-col">
            <span class="font-medium">{{ flow.name }}</span>
            <div class="text-muted flex items-center gap-2 text-xs">
              <span>{{ TRIGGER_LABELS[getTriggerType(flow)] || "—" }}</span>
              <span v-if="getScheduleLabel(flow)" class="text-primary font-mono">{{
                getScheduleLabel(flow)
              }}</span>
              <span>·</span>
              <span
                >{{ getNodeCount(flow) }} {{ getNodeCount(flow) === 1 ? "node" : "nodes" }}</span
              >
            </div>
          </div>
          <span
            class="inline-flex h-5 items-center rounded px-1.5 text-xs font-medium"
            :class="STATUS_CLASS[flow.status || 'draft']"
          >
            {{ flow.status || "draft" }}
          </span>
        </button>
      </div>
    </UScrollArea>
  </div>
</template>
