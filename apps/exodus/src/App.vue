<script setup lang="ts">
import { ref } from "vue"
import AppSidebar from "@/components/AppSidebar.vue"
import AppTopMenu from "@/components/AppTopMenu.vue"
import UpdateOverlay from "@/components/UpdateOverlay.vue"
import AgentSidebar from "@/components/AgentSidebar.vue"

const agentOpen = ref(false)
</script>

<template>
  <UApp>
    <div class="bg-elevated flex h-screen pr-2 pb-2">
      <AppSidebar class="pt-8" />
      <div class="flex flex-1 flex-col overflow-hidden">
        <AppTopMenu v-model:agent-open="agentOpen" />
        <div class="flex flex-1 gap-2 overflow-hidden">
          <main
            class="border-default bg-default min-w-0 flex-1 overflow-hidden rounded-xl border shadow-sm"
          >
            <RouterView />
          </main>
          <AgentSidebar v-if="agentOpen" v-model:open="agentOpen" />
        </div>
      </div>
    </div>
    <UpdateOverlay />
  </UApp>
</template>
