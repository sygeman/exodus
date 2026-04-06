<script setup lang="ts">
const props = defineProps<{
  selectedNodeId: string | null
}>()

const emit = defineEmits<{
  send: [message: string]
}>()

const message = ref('')

function onSend() {
  if (!message.value.trim()) return
  emit('send', message.value)
  message.value = ''
}
</script>

<template>
  <div class="acsd-dialog-panel bg-neutral-900 border-t border-neutral-800 p-4">
    <div class="flex gap-2">
      <UInput
        v-model="message"
        placeholder="Сообщение..."
        class="flex-1"
        @keyup.enter="onSend"
      />
      <UButton color="primary" @click="onSend">
        <UIcon name="i-lucide-send" class="w-4 h-4" />
      </UButton>
    </div>
  </div>
</template>
