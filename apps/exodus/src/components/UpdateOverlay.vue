<script setup lang="ts">
import { computed } from "vue"
import { useT } from "@exodus/edem-vue"
import { useUpdateStatus } from "@/hooks"

const t = useT()
const { status } = useUpdateStatus()

const isUpdating = computed(() => status.value === "downloading" || status.value === "applying")

const statusText = computed(() => {
  if (status.value === "downloading") return t({ en: "Downloading...", ru: "Загрузка..." })
  if (status.value === "applying") return t({ en: "Applying...", ru: "Установка..." })
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
        class="bg-default/95 fixed inset-0 z-50 flex flex-col items-center justify-center"
      >
        <!-- Логотип / иконка -->
        <div class="mb-8 flex items-center justify-center">
          <div class="relative">
            <div
              class="bg-primary/10 flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl"
            >
              <UIcon name="i-lucide-arrow-up-circle" class="text-primary h-8 w-8" />
            </div>
            <div class="bg-primary/20 absolute inset-0 h-16 w-16 animate-ping rounded-2xl" />
          </div>
        </div>

        <!-- Заголовок -->
        <h2 class="text-default mb-6 text-xl font-semibold">
          {{ t({ en: "Updating application", ru: "Обновление приложения" }) }}
        </h2>

        <!-- Статус с индикатором -->
        <div class="flex items-center gap-3">
          <span
            class="border-default border-t-primary inline-block h-4 w-4 animate-spin rounded-full border-2"
          />
          <span class="text-default text-sm font-medium">{{ statusText }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
