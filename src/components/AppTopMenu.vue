<script setup lang="ts">
const version = __APP_VERSION__
</script>

<template>
  <div class="flex h-8 items-center justify-end px-4">
    <UBadge color="neutral" variant="subtle" size="sm">
      {{ version }}
    </UBadge>
  </div>
</template>
