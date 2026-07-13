<script setup lang="ts">
import { computed } from "vue"
import { type MessagePart, cleanText } from "@/agent-parts"
import { renderMarkdown } from "@/agent-markdown"

const props = defineProps<{
  part: MessagePart
}>()

const html = computed(() => {
  const text = typeof props.part.text === "string" ? cleanText(props.part.text) : ""
  return renderMarkdown(text)
})
</script>

<template>
  <div class="chat-markdown text-default text-sm" v-html="html" />
</template>
