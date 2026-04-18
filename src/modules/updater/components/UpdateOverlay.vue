<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { useUpdaterStatus } from "@/modules/updater/composables/useUpdaterStatus"

const { t } = useI18n()
const { updateStatus, latestVersion } = useUpdaterStatus()

const isUpdating = computed(
  () => updateStatus.value === "downloading" || updateStatus.value === "applying",
)

const statusText = computed(() => {
  if (updateStatus.value === "downloading") return t("updater.downloading")
  if (updateStatus.value === "applying") return t("updater.applying")
  return ""
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-300"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isUpdating"
        role="status"
        aria-live="polite"
        class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--ui-bg)]/95"
      >
        <!-- Логотип / иконка -->
        <div class="mb-8 flex items-center justify-center">
          <div class="relative">
            <div
              class="flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-[var(--ui-primary)]/10"
            >
              <UIcon name="i-lucide-arrow-up-circle" class="h-8 w-8 text-[var(--ui-primary)]" />
            </div>
            <div
              class="absolute inset-0 h-16 w-16 animate-ping rounded-2xl bg-[var(--ui-primary)]/20"
            />
          </div>
        </div>

        <!-- Заголовок -->
        <h2 class="mb-2 text-xl font-semibold text-[var(--ui-text)]">
          {{ t("updater.updateInProgress") }}
        </h2>

        <!-- Описание версии -->
        <p class="mb-6 text-sm text-[var(--ui-text-muted)]">
          {{ t("updater.updateInProgressDescription", { version: latestVersion }) }}
        </p>

        <!-- Статус с индикатором -->
        <div class="flex items-center gap-3">
          <span
            class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--ui-border)] border-t-[var(--ui-primary)]"
          />
          <span class="text-sm font-medium text-[var(--ui-text)]">{{ statusText }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
