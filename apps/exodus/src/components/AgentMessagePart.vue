<script setup lang="ts">
import type { MessagePart } from "@/agent-parts"
import AgentTextPart from "./AgentTextPart.vue"
import AgentToolPart from "./AgentToolPart.vue"

defineProps<{
  part: MessagePart
}>()
</script>

<template>
  <AgentTextPart v-if="part.type === 'text'" :part="part" />
  <AgentToolPart v-else-if="part.type === 'tool'" :part="part" />
  <div
    v-else-if="part.type === 'reasoning'"
    class="reasoning-block border-default border-l-2 py-1 pl-3 text-xs opacity-60"
  >
    <div class="text-muted mb-1 font-medium">Thinking...</div>
    <div class="text-default whitespace-pre-wrap">{{ part.text }}</div>
  </div>
  <div v-else-if="part.type === 'agent'" class="text-muted flex items-center gap-1.5 py-1 text-xs">
    <span class="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs font-medium">
      {{ part.name || "agent" }}
    </span>
  </div>
</template>
