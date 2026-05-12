<script setup lang="ts">
import { computed } from "vue"
import { useT } from "@exodus/edem-vue"
import { useRouter } from "vue-router"
import { useVersion, useUpdateStatus, useStartUpdate } from "@/hooks"

const t = useT()
const router = useRouter()

const { version } = useVersion()
const { status: updateStatus, latestVersion } = useUpdateStatus()
const [startUpdate] = useStartUpdate()

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
