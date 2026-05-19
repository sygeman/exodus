<script setup lang="ts">
import { useRoute } from "vue-router"

const route = useRoute()
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="relative flex flex-1 overflow-hidden">
      <pre class="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">{{ manifest }}</pre>
      <UTooltip
        :text="
          copied ? t({ en: 'Copied!', ru: 'Скопировано!' }) : t({ en: 'Copy', ru: 'Копировать' })
        "
      >
        <UButton
          variant="outline"
          size="xs"
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          class="absolute top-3 right-3"
          @click="copyToClipboard($event)"
        />
      </UTooltip>
    </div>
  </div>
</template>
