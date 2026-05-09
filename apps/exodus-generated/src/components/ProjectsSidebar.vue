<script setup lang="ts">
import { ref } from "vue"
import { useEdem } from "@/edem"

const edem = useEdem()

function handleCreateProject() {
  edem.flows.trigger({ flow_id: "createProject" })
}

// TODO: implement getInitials
</script>

<template>
  <div class="scrollbar-hidden flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto pt-2 select-none">
    <UContextMenu v-for="(item, idx) in projects" :key="idx">
      <UTooltip :text="item.name" :delay-duration="0">
        <ULink :to="`/project/${item.id}/overview`" class="electrobun-webkit-app-region-no-drag bg-default/50 flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg font-semibold transition-all">{{ getInitials(item.name) }}</ULink>
      </UTooltip>
    </UContextMenu>
    <UTooltip text="New project" :delay-duration="0">
      <button class="electrobun-webkit-app-region-no-drag flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg)] hover:text-[var(--ui-text)]" @click="handleCreateProject()">
        <UIcon name="i-lucide-plus" class="h-5 w-5" />
      </button>
    </UTooltip>
    <UModal v-model:open="deleteModalOpen" title="Delete project" description="Are you sure you want to delete this project? This action cannot be undone.">
      <template #footer>
        <div class="flex w-full justify-end gap-3">

        </div>
      </template>
    </UModal>
  </div>
</template>
