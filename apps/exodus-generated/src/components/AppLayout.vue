<script setup lang="ts">

</script>

<template>
  <div class="flex h-screen bg-[var(--ui-bg-elevated)] pr-2 pb-2">
    <AppSidebar class="pt-8" />
    <div class="flex flex-1 flex-col overflow-hidden">
      <AppTopMenu />
      <main class="flex-1 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-sm">
        <RouterView />
      </main>
    </div>
  </div>
</template>
