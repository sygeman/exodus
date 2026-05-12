<script setup lang="ts">
import AppSidebar from "@/components/AppSidebar.vue"
import AppTopMenu from "@/components/AppTopMenu.vue"
import UpdateOverlay from "@/components/UpdateOverlay.vue"
</script>

<template>
  <UApp>
    <div class="bg-elevated flex h-screen pr-2 pb-2">
      <AppSidebar class="pt-8" />
      <div class="flex flex-1 flex-col overflow-hidden">
        <AppTopMenu />
        <main class="border-default bg-default flex-1 overflow-hidden rounded-xl border shadow-sm">
          <RouterView />
        </main>
      </div>
    </div>
    <UpdateOverlay />
  </UApp>
</template>
