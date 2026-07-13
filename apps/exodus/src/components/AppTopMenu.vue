<script setup lang="ts">
import { computed } from "vue"
import { useT } from "@exodus/edem-vue"
import { useRouter } from "vue-router"
import { useVersion, useUpdateStatus, useStartUpdate } from "@/hooks"
import { agentState, useAgentVoice } from "@/hooks-agent"

const t = useT()
const router = useRouter()

const { version } = useVersion()
const { status: updateStatus, latestVersion } = useUpdateStatus()
const [startUpdate] = useStartUpdate()

const { isRecording } = useAgentVoice()

const agentOpen = defineModel<boolean>("agentOpen", { default: false })

const isUpdateAvailable = computed(() => updateStatus.value === "available")

function goBack() {
  router.back()
}

function goForward() {
  router.forward()
}
</script>

<template>
  <div
    class="electrobun-webkit-app-region-drag flex h-8 items-center justify-between px-3 select-none"
  >
    <div class="electrobun-webkit-app-region-no-drag flex items-center select-none">
      <button
        class="text-muted hover:bg-default hover:text-default flex h-6 w-6 items-center justify-center rounded transition-colors"
        @click="goBack"
      >
        <UIcon name="i-lucide-arrow-left" class="h-3.5 w-3.5" />
      </button>
      <button
        class="text-muted hover:bg-default hover:text-default flex h-6 w-6 items-center justify-center rounded transition-colors"
        @click="goForward"
      >
        <UIcon name="i-lucide-arrow-right" class="h-3.5 w-3.5" />
      </button>
    </div>
    <div class="electrobun-webkit-app-region-no-drag flex items-center gap-2 select-none">
      <button
        class="relative flex h-6 w-6 items-center justify-center rounded transition-colors"
        :class="[
          agentOpen ? 'bg-default text-default' : 'text-muted hover:bg-default hover:text-default',
        ]"
        @click="agentOpen = !agentOpen"
      >
        <UIcon name="i-lucide-sparkles" class="h-3.5 w-3.5" />
        <div
          v-if="agentState.thinking"
          class="bg-primary absolute -top-0.5 -right-0.5 h-1.5 w-1.5 animate-pulse rounded-full"
        />
        <div
          v-else-if="isRecording"
          class="bg-error absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full"
        />
      </button>
      <RouterLink
        to="/debug"
        class="text-muted hover:bg-default hover:text-default flex h-6 w-6 items-center justify-center rounded transition-colors"
        active-class="bg-default text-default"
      >
        <UIcon name="i-lucide-bug" class="h-3.5 w-3.5" />
      </RouterLink>
      <div class="flex items-center select-text">
        <UButton
          v-if="isUpdateAvailable"
          color="primary"
          variant="soft"
          size="xs"
          :ui="{ leadingIcon: 'size-3.5' }"
          @click="startUpdate()"
        >
          <template #leading>
            <UIcon name="i-lucide-arrow-up-circle" />
          </template>
          {{ t({ en: "Update to", ru: "Обновить до" }) }} v{{ latestVersion }}
        </UButton>
        <UBadge v-else color="neutral" variant="subtle" size="sm">
          {{ version }}
        </UBadge>
      </div>
    </div>
  </div>
</template>
