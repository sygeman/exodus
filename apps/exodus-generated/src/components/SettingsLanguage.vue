<script setup lang="ts">
import { useT } from "@/composables/useT"

const t = useT()

import { computed } from "vue"
import { useSingleton } from "@/hooks"

const { data: appState, update: updateSetting } = useSingleton("app_state")

const locales = computed(
  () => (appState.value?.data.locales as { value: string; label: string; flag: string }[]) ?? [],
)

const selectedLocale = computed({
  get() {
    return appState.value?.data.locale
  },
  set(value) {
    updateSetting({ locale: value })
  },
})
</script>

<template>
  <section class="flex flex-col gap-8">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h3 class="text-base font-medium">{{ t({ en: "Language", ru: "Язык" }) }}</h3>
        <p class="text-muted text-sm">
          {{
            t({
              en: "Select the language you want to use in the app.",
              ru: "Выберите язык, который хотите использовать в приложении.",
            })
          }}
        </p>
      </div>
      <div class="flex flex-col gap-3" v-for="(item, idx) in locales" :key="idx">
        <button
          type="button"
          class="flex items-center gap-3 rounded-md border p-3 text-left text-sm transition-all"
        >
          <span class="text-2xl">{{ item.flag }}</span>
          <span class="font-medium">{{ item.label }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
