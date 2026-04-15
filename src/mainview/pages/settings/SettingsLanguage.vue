<script setup lang="ts">
import { computed, watch } from "vue"
import { useI18n } from "vue-i18n"
import { locales, type Locale } from "@/mainview/locales"
import { evento } from "@/mainview/evento"

const { t, locale } = useI18n()

const selectedLocale = computed<Locale>({
  get() {
    return locale.value as Locale
  },
  set(value: Locale) {
    locale.value = value
  },
})

watch(selectedLocale, (value) => {
  evento.emitEvent("app:saveSettings", { locale: value }, "webview")
})
</script>

<template>
  <section class="flex flex-col gap-8">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h3 class="text-base font-medium">{{ t("common.language") }}</h3>
        <p class="text-sm text-[var(--ui-text-muted)]">{{ t("settings.languageDescription") }}</p>
      </div>

      <div class="flex flex-col gap-3">
        <button
          v-for="l in locales"
          :key="l.value"
          type="button"
          class="flex items-center gap-4 rounded-lg border p-4 text-left transition-all"
          :class="{
            'border-[var(--ui-primary)] bg-[var(--ui-primary)]/10 text-[var(--ui-text)]':
              selectedLocale === l.value,
            'border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]/30 text-[var(--ui-text-muted)] hover:border-[var(--ui-border-accent)] hover:bg-[var(--ui-bg-elevated)]':
              selectedLocale !== l.value,
          }"
          @click="selectedLocale = l.value"
        >
          <span class="text-3xl">{{ l.flag }}</span>
          <span class="text-lg font-medium">{{ l.label }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
