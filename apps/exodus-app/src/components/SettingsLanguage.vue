<script setup lang="ts">
function handleSetLocale(item) {
  edem.flows.trigger({ flow_id: "setLocale", locale: item.value })
}
</script>

<template>
  <div class="overflow-y-auto p-10">
    <h1 class="mb-6 text-lg font-bold">Settings</h1>
    <section>
      <div class="mb-4">
        <h3 class="font-medium">Language</h3>
        <p class="text-muted text-sm">Select your preferred language</p>
      </div>
      <div class="flex flex-col gap-2" v-for="(item, idx) in locales" :key="idx">
        <button
          class="hover:bg-elevated flex items-center gap-3 rounded-lg border p-3 transition-colors"
          @click="handleSetLocale(item)"
        >
          <span class="text-lg">{{ item.flag }}</span>
          <span class="font-medium">{{ item.label }}</span>
        </button>
      </div>
    </section>
  </div>
</template>
