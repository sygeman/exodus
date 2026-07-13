<script setup lang="ts">
import { ref, computed, watch } from "vue"
import { useT } from "@exodus/edem-vue"
import { useAgentChat, useAgentSpeech, useAgentSettings, agentState } from "@/hooks-agent"
import { filterVisibleParts, extractPlainText, normalizeMessage } from "@/agent-parts"
import AgentMessagePart from "./AgentMessagePart.vue"
import AgentTextPart from "./AgentTextPart.vue"

const t = useT()
const { settings, updateSettings } = useAgentSettings()

const {
  sessions,
  currentSession,
  messages,
  loading,
  error,
  streamingParts,
  sendMessage,
  createSession,
  switchSession,
  deleteSession,
  abortSession,
} = useAgentChat()

const { isSpeaking, speak, stop: stopSpeaking } = useAgentSpeech()

const inputText = ref("")
const messagesContainer = ref<HTMLElement | null>(null)
const isOpen = defineModel<boolean>("open", { default: false })
const showSessions = ref(false)
let autoOpened = false

let scrollTimer: ReturnType<typeof setTimeout> | null = null

function scrollToBottom() {
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    const el = messagesContainer.value
    if (el) el.scrollTop = el.scrollHeight
  }, 50)
}

watch(
  () => sessions.value.length,
  (len) => {
    if (len > 0 && !currentSession.value && !autoOpened) {
      autoOpened = true
      void switchSession(sessions.value[0].id)
    }
  },
)

const displayMessages = computed(() => {
  const showReasoning = settings.value.show_reasoning
  const msgs = messages.value
    .map((m) => {
      const normalized = normalizeMessage(m)
      const visibleParts = filterVisibleParts(normalized.parts, showReasoning)
      if (visibleParts.length === 0) return null
      return {
        id: normalized.id,
        role: normalized.role,
        parts: visibleParts,
      }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)

  if (streamingParts.value.length > 0) {
    const visibleParts = filterVisibleParts(streamingParts.value as never[], showReasoning)
    if (visibleParts.length > 0) {
      msgs.push({
        id: "streaming",
        role: "assistant",
        parts: visibleParts,
      })
    }
  }

  return msgs
})

watch(displayMessages, scrollToBottom)

const statusText = computed(() => {
  if (agentState.value.thinking) return t({ en: "Thinking", ru: "Думаю" })
  if (isSpeaking.value) return t({ en: "Speaking", ru: "Говорю" })
  return ""
})

function sanitizeForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]\([^)]*\)/g, (m) => m.match(/\[([^\]]*)\]/)?.[1] ?? "")
    .replace(/#{1,6}\s/g, "")
    .replace(/[*_~>]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/[<>(){}[\]]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

const lastSpokenId = ref<string | null>(null)
let skipFirstIdle = true

watch(
  () => currentSession.value?.id,
  () => {
    skipFirstIdle = true
    lastSpokenId.value = null
  },
)

watch(loading, (isLoading, wasLoading) => {
  if (!wasLoading || isLoading) return

  if (skipFirstIdle) {
    skipFirstIdle = false
    return
  }

  setTimeout(() => {
    const lastAssistant = [...messages.value].toReversed().find((m) => m.info.role === "assistant")
    if (lastAssistant && lastAssistant.info.id !== lastSpokenId.value) {
      lastSpokenId.value = lastAssistant.info.id
      if (settings.value.auto_speak) {
        const normalized = normalizeMessage(lastAssistant)
        const content = extractPlainText(normalized.parts)
        const clean = sanitizeForSpeech(content)
        if (clean) speak(clean, settings.value.volume)
      }
    }
  }, 300)
})

async function handleSend() {
  const content = inputText.value.trim()
  if (!content) return
  inputText.value = ""
  await sendMessage(content)
}

function sendPrompt(text: string) {
  inputText.value = text
  handleSend()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

async function handleNewSession() {
  await createSession()
  showSessions.value = false
}

async function handleSwitchSession(id: string) {
  await switchSession(id)
  showSessions.value = false
}

async function handleDeleteSession(id: string, e: Event) {
  e.stopPropagation()
  await deleteSession(id)
}

function formatSessionTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

const suggestedPrompts = [
  { en: "Show my projects", ru: "Покажи мои проекты" },
  { en: "Create a new flow", ru: "Создай новый флоу" },
  { en: "Help me with this page", ru: "Помоги с этой страницей" },
]
</script>

<template>
  <div
    class="border-default bg-default flex w-96 shrink-0 flex-col overflow-hidden rounded-xl border shadow-sm"
  >
    <!-- Header -->
    <div class="border-default flex items-center justify-between border-b px-4 py-2.5">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-sparkles" class="text-primary h-4 w-4" />
        <div class="flex flex-col">
          <span class="text-default text-sm font-semibold">
            {{ currentSession?.title ?? t({ en: "AI Agent", ru: "AI Агент" }) }}
          </span>
          <span v-if="settings.opencode_model_id" class="text-muted text-[10px]">
            {{ settings.opencode_model_id }}
          </span>
          <span v-if="currentSession?.directory" class="text-muted truncate text-[10px]">
            {{ currentSession.directory }}
          </span>
        </div>
        <span v-if="statusText" class="text-muted text-xs"> · {{ statusText }}</span>
      </div>
      <div class="flex items-center gap-1">
        <UTooltip
          :text="
            settings.show_reasoning
              ? t({ en: 'Hide reasoning', ru: 'Скрыть рассуждения' })
              : t({ en: 'Show reasoning', ru: 'Показать рассуждения' })
          "
          :delay-duration="0"
        >
          <button
            class="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            :class="settings.show_reasoning ? 'text-primary' : 'text-muted hover:text-default'"
            @click="updateSettings({ show_reasoning: !settings.show_reasoning })"
          >
            <UIcon name="i-lucide-brain" class="h-4 w-4" />
          </button>
        </UTooltip>
        <UTooltip
          :text="
            settings.auto_speak
              ? t({ en: 'Mute', ru: 'Выключить звук' })
              : t({ en: 'Speak', ru: 'Озвучивать' })
          "
          :delay-duration="0"
        >
          <button
            class="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            :class="settings.auto_speak ? 'text-primary' : 'text-muted hover:text-default'"
            @click="updateSettings({ auto_speak: !settings.auto_speak })"
          >
            <UIcon
              :name="settings.auto_speak ? 'i-lucide-volume-2' : 'i-lucide-volume-off'"
              class="h-4 w-4"
            />
          </button>
        </UTooltip>
        <UTooltip v-if="isSpeaking" :text="t({ en: 'Stop', ru: 'Остановить' })" :delay-duration="0">
          <button
            class="text-muted hover:text-default flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            @click="stopSpeaking"
          >
            <UIcon name="i-lucide-volume-x" class="h-4 w-4" />
          </button>
        </UTooltip>
        <UTooltip :text="t({ en: 'Sessions', ru: 'Сессии' })" :delay-duration="0">
          <button
            class="text-muted hover:text-default flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            :class="{ 'text-default': showSessions }"
            @click="showSessions = !showSessions"
          >
            <UIcon name="i-lucide-message-square" class="h-4 w-4" />
          </button>
        </UTooltip>
        <UTooltip :text="t({ en: 'Close', ru: 'Закрыть' })" :delay-duration="0">
          <button
            class="text-muted hover:text-default flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            @click="isOpen = false"
          >
            <UIcon name="i-lucide-x" class="h-4 w-4" />
          </button>
        </UTooltip>
      </div>
    </div>

    <!-- Sessions list -->
    <div v-if="showSessions" class="border-default flex flex-col border-b">
      <div class="flex items-center justify-between px-3 py-2">
        <span class="text-muted text-xs font-medium">
          {{ t({ en: "Sessions", ru: "Сессии" }) }}
        </span>
        <button
          class="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-medium transition-colors"
          @click="handleNewSession"
        >
          <UIcon name="i-lucide-plus" class="h-3 w-3" />
          {{ t({ en: "New", ru: "Новая" }) }}
        </button>
      </div>
      <div class="max-h-48 overflow-y-auto">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="hover:bg-elevated flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors"
          :class="{ 'bg-elevated': currentSession?.id === session.id }"
          role="button"
          tabindex="0"
          @click="handleSwitchSession(session.id)"
          @keydown.enter="handleSwitchSession(session.id)"
        >
          <UIcon name="i-lucide-message-circle" class="text-muted h-3.5 w-3.5 shrink-0" />
          <div class="min-w-0 flex-1">
            <span class="text-default block truncate text-xs">
              {{ session.title }}
            </span>
            <span v-if="session.directory" class="text-muted block truncate text-[10px]">
              {{ session.directory }}
            </span>
          </div>
          <span class="text-muted shrink-0 text-[10px]">
            {{ formatSessionTime(session.time.updated) }}
          </span>
          <button
            class="text-muted hover:text-error shrink-0 rounded p-0.5 transition-colors"
            @click="handleDeleteSession(session.id, $event)"
          >
            <UIcon name="i-lucide-x" class="h-3 w-3" />
          </button>
        </div>
        <div v-if="sessions.length === 0" class="text-muted px-3 py-4 text-center text-xs">
          {{ t({ en: "No sessions yet", ru: "Пока нет сессий" }) }}
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-2">
      <template v-if="displayMessages.length > 0">
        <div
          v-for="msg in displayMessages"
          :key="msg.id"
          :id="`message-${msg.id}`"
          class="group w-full"
          :class="msg.role === 'user' ? 'pt-2' : 'pt-4'"
        >
          <div class="chat-message-column relative">
            <div v-if="msg.role === 'user'" class="flex justify-end">
              <div
                class="border-primary/5 max-w-[85%] rounded-xl border px-4 py-2.5"
                style="
                  background-color: var(--chat-user-message-bg);
                  border-bottom-right-radius: var(--radius-sm);
                "
              >
                <template v-for="(part, pi) in msg.parts" :key="pi">
                  <AgentTextPart v-if="part.type === 'text'" :part="part" />
                </template>
              </div>
            </div>
            <div v-else class="relative">
              <div v-for="(part, pi) in msg.parts" :key="pi">
                <AgentMessagePart :part="part" />
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Empty state -->
      <div v-else class="flex h-full flex-col items-center justify-center gap-6 px-8">
        <div class="flex flex-col items-center gap-3 text-center">
          <div class="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
            <UIcon name="i-lucide-sparkles" class="text-primary h-6 w-6" />
          </div>
          <p class="text-default text-sm font-medium">
            {{ t({ en: "How can I help?", ru: "Чем помочь?" }) }}
          </p>
          <p class="text-muted text-xs">
            {{
              t({
                en: "Ask anything or try a prompt below",
                ru: "Спросите или попробуйте подсказку",
              })
            }}
          </p>
        </div>
        <div class="flex w-full flex-col gap-1.5">
          <button
            v-for="prompt in suggestedPrompts"
            :key="prompt.en"
            class="hover:bg-elevated text-default flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-xs transition-colors"
            @click="sendPrompt(t(prompt))"
          >
            <UIcon name="i-lucide-corner-down-right" class="text-muted h-3 w-3 shrink-0" />
            {{ t(prompt) }}
          </button>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="border-error/20 bg-error/5 flex items-start gap-2 border-t px-3 py-2">
      <UIcon name="i-lucide-alert-circle" class="text-error mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p class="text-error min-w-0 flex-1 text-xs">{{ error }}</p>
      <button class="text-muted hover:text-default shrink-0" @click="error = null">
        <UIcon name="i-lucide-x" class="h-3 w-3" />
      </button>
    </div>

    <!-- Input -->
    <div class="border-default border-t p-3">
      <div class="flex items-end gap-2">
        <UTextarea
          v-model="inputText"
          :placeholder="t({ en: 'Message...', ru: 'Сообщение...' })"
          :rows="1"
          :maxrows="4"
          autoresize
          size="sm"
          class="flex-1"
          @keydown="handleKeydown"
        />
        <button
          v-if="loading"
          class="bg-error/10 text-error flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
          @click="abortSession"
        >
          <UIcon name="i-lucide-square" class="h-4 w-4" />
        </button>
        <button
          v-else
          class="bg-primary text-primary-inverse flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-opacity"
          :class="{ 'opacity-30': !inputText.trim() }"
          :disabled="!inputText.trim()"
          @click="handleSend()"
        >
          <UIcon name="i-lucide-arrow-up" class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-markdown {
  overflow-wrap: break-word;
  word-break: break-word;
  min-width: 0;
}
.chat-markdown :deep(p) {
  margin: 0 0 0.35em;
  line-height: 1.5;
}
.chat-markdown :deep(p:last-child) {
  margin-bottom: 0;
}
.chat-markdown :deep(pre) {
  background: var(--ui-bg-elevated);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  overflow-x: auto;
  margin: 0.5em 0;
  font-size: 0.8rem;
  max-width: 100%;
}
.chat-markdown :deep(code) {
  font-size: 0.85em;
}
.chat-markdown :deep(:not(pre) > code) {
  background: var(--ui-bg-elevated);
  border-radius: 0.25rem;
  padding: 0.15em 0.35em;
  font-size: 0.85em;
}
.chat-markdown :deep(ul),
.chat-markdown :deep(ol) {
  padding-left: 1.25em;
  margin: 0.5em 0;
}
.chat-markdown :deep(li) {
  margin: 0.15em 0;
}
.chat-markdown :deep(blockquote) {
  border-left: 3px solid var(--ui-border-muted);
  padding-left: 0.75em;
  margin: 0.5em 0;
  opacity: 0.8;
}
.chat-markdown :deep(h1),
.chat-markdown :deep(h2),
.chat-markdown :deep(h3),
.chat-markdown :deep(h4) {
  font-weight: 600;
  margin: 0.75em 0 0.25em;
}
.chat-markdown :deep(h1) {
  font-size: 1.25em;
}
.chat-markdown :deep(h2) {
  font-size: 1.15em;
}
.chat-markdown :deep(h3) {
  font-size: 1.05em;
}
.chat-markdown :deep(table) {
  border-collapse: collapse;
  margin: 0.5em 0;
  font-size: 0.85em;
}
.chat-markdown :deep(th),
.chat-markdown :deep(td) {
  border: 1px solid var(--ui-border-muted);
  padding: 0.35em 0.65em;
}
.chat-markdown :deep(th) {
  background: var(--ui-bg-elevated);
  font-weight: 600;
}
.chat-markdown :deep(a) {
  color: var(--ui-text-primary);
  text-decoration: underline;
}
.chat-markdown :deep(hr) {
  border: none;
  border-top: 1px solid var(--ui-border-muted);
  margin: 0.75em 0;
}
.chat-markdown :deep(.reasoning-block) {
  opacity: 0.45;
  font-size: 0.85em;
  border-left: 2px solid var(--ui-border-muted);
  padding-left: 0.75em;
  margin: 0.5em 0;
}
.chat-markdown :deep(em) {
  opacity: 0.7;
  font-size: 0.85em;
}
.chat-markdown :deep(.tool-diff) {
  margin: 0.5em 0;
  border-radius: 0.5rem;
  overflow: hidden;
  font-size: 0.8rem;
}
.chat-markdown :deep(.tool-diff-path) {
  background: var(--ui-bg-elevated);
  padding: 0.35em 0.75em;
  font-family: monospace;
  font-size: 0.85em;
  opacity: 0.7;
  border-bottom: 1px solid var(--ui-border-muted);
}
.chat-markdown :deep(.tool-diff-old) {
  background: color-mix(in srgb, var(--ui-color-error) 10%, transparent);
  padding: 0.35em 0.75em;
  font-family: monospace;
  border-bottom: 1px solid var(--ui-border-muted);
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-markdown :deep(.tool-diff-new) {
  background: color-mix(in srgb, var(--ui-color-success) 10%, transparent);
  padding: 0.35em 0.75em;
  font-family: monospace;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
