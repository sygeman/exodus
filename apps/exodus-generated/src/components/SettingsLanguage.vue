<script setup lang="ts">
import { computed } from "vue"
import { useApp_state } from "@/composables/useApp_state"
import { useT } from "@exodus/edem-vue"

const { item: appState, loading: appStateLoading, update: updateApp_state } = useApp_state()
const locales = computed(() => appState.value?.locales ?? [])
const selectedLocale = computed(() => appState.value?.locale)
const t = useT()

async function updateLocale($event?: Event, item?: Record<string, unknown>) {
  await updateApp_state({ locale: item?.value })
}
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
      <div class="flex flex-col gap-3">
        <button
          v-for="l in locales"
          :key="l.value"
          type="button"
          class="flex items-center gap-3 rounded-md border p-3 text-left text-sm transition-all"
          :class="{
            'border-primary bg-primary/10 text-default': selectedLocale === l.value,
            'text-muted border-default bg-elevated/30 hover:bg-elevated hover:border-accent':
              selectedLocale !== l.value,
          }"
          @click="updateLocale($event, item)"
        >
          <span class="text-2xl">{{ l.flag }}</span>
          <span class="font-medium">{{ l.label }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
