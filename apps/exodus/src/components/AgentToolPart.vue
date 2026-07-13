<script setup lang="ts">
import { ref, computed } from "vue"
import type { MessagePart, ToolState } from "@/agent-parts"
import {
  getToolCategory,
  getToolTitle,
  truncateOutput,
  parseDiffHunks,
  parseReadOutput,
  parseGrepOutput,
  parseGlobOutput,
  parseDirectoryOutput,
} from "@/agent-tool-renderers"

const props = defineProps<{
  part: MessagePart
}>()

const expanded = ref(false)

const toolName = computed(() => (typeof props.part.tool === "string" ? props.part.tool : "tool"))
const state = computed(() => (props.part.state ?? {}) as ToolState)
const category = computed(() => getToolCategory(toolName.value))
const title = computed(() => getToolTitle(state.value, toolName.value))
const status = computed(() => state.value.status)
const input = computed(() => state.value.input ?? {})
const output = computed(() => (typeof state.value.output === "string" ? state.value.output : ""))
const error = computed(() => (typeof state.value.error === "string" ? state.value.error : ""))

const isRunning = computed(() => status.value === "running")
const isCompleted = computed(() => status.value === "completed")
const isPending = computed(() => status.value === "pending")
const isError = computed(() => status.value === "error")

const editFilePath = computed(() =>
  typeof input.value.file_path === "string" ? input.value.file_path : "",
)
const editOldStr = computed(() =>
  typeof input.value.old_string === "string" ? input.value.old_string : "",
)
const editNewStr = computed(() =>
  typeof input.value.new_string === "string" ? input.value.new_string : "",
)
const bashCommand = computed(() =>
  typeof input.value.command === "string" ? input.value.command : "",
)
const readFilePath = computed(() =>
  typeof input.value.file_path === "string" ? input.value.file_path : "",
)

const diffHunks = computed(() => {
  if (category.value !== "edit" || !output.value) return []
  return parseDiffHunks(output.value)
})

const readOutput = computed(() => {
  if (category.value !== "read" || !output.value) return null
  return parseReadOutput(output.value)
})

const grepResults = computed(() => {
  if (toolName.value !== "grep" || !output.value) return []
  return parseGrepOutput(output.value)
})

const globResults = computed(() => {
  if (toolName.value !== "glob" || !output.value) return []
  return parseGlobOutput(output.value)
})

const directoryItems = computed(() => {
  if (!readOutput.value || readOutput.value.type !== "directory") return []
  return parseDirectoryOutput(readOutput.value.lines.map((l) => l.text).join("\n"))
})

function toggleExpand() {
  expanded.value = !expanded.value
}

const statusIcon = computed(() => {
  if (isRunning.value) return "⏳"
  if (isCompleted.value) return "✓"
  if (isPending.value) return "⏳"
  if (isError.value) return "✗"
  return ""
})

const statusClass = computed(() => {
  if (isRunning.value) return "text-warning"
  if (isCompleted.value) return "text-success"
  if (isPending.value) return "text-muted"
  if (isError.value) return "text-error"
  return ""
})
</script>

<template>
  <div class="border-default my-1.5 overflow-hidden rounded-lg border">
    <button
      class="bg-elevated hover:bg-elevated/80 flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors"
      @click="toggleExpand"
    >
      <span :class="statusClass" class="text-xs">{{ statusIcon }}</span>
      <span class="text-default flex-1 text-xs font-medium">{{ title }}</span>
      <span v-if="isRunning" class="text-warning animate-pulse text-xs">running</span>
      <span v-if="isPending" class="text-muted text-xs">pending</span>
      <span v-if="isError" class="text-error text-xs">error</span>
      <span class="text-muted text-xs">{{ expanded ? "▲" : "▼" }}</span>
    </button>

    <div v-if="expanded" class="border-default border-t">
      <div v-if="category === 'bash' && bashCommand" class="p-2">
        <pre class="bg-default overflow-x-auto rounded p-2 font-mono text-xs">{{
          bashCommand
        }}</pre>
      </div>

      <div v-if="category === 'edit' && editFilePath" class="p-2">
        <div class="text-muted mb-1 truncate font-mono text-xs">{{ editFilePath }}</div>
        <div v-if="diffHunks.length > 0" class="space-y-1">
          <div v-for="(hunk, hi) in diffHunks" :key="hi">
            <div class="text-muted mb-0.5 font-mono text-xs opacity-60">{{ hunk.header }}</div>
            <pre
              class="overflow-x-auto text-xs"
            ><template v-for="(line, li) in hunk.lines" :key="li"><span
              :class="{
                'bg-success/10 text-success': line.type === 'add',
                'bg-error/10 text-error': line.type === 'remove',
                'text-default': line.type === 'context',
              }"
              class="block px-2 font-mono"
            >{{ line.type === "add" ? "+" : line.type === "remove" ? "-" : " " }}{{ line.content }}</span></template></pre>
          </div>
        </div>
        <div v-else-if="editOldStr || editNewStr" class="space-y-1">
          <pre
            v-if="editOldStr"
            class="bg-error/10 text-error overflow-x-auto rounded p-2 font-mono text-xs"
            >{{ editOldStr }}</pre
          >
          <pre
            v-if="editNewStr"
            class="bg-success/10 text-success overflow-x-auto rounded p-2 font-mono text-xs"
            >{{ editNewStr }}</pre
          >
        </div>
      </div>

      <div v-if="category === 'read' && readOutput" class="p-2">
        <div class="text-muted mb-1 truncate font-mono text-xs">{{ readFilePath }}</div>
        <div
          v-if="readOutput.type === 'directory' && directoryItems.length > 0"
          class="space-y-0.5"
        >
          <div
            v-for="(item, i) in directoryItems"
            :key="i"
            class="font-mono text-xs"
            :style="{ paddingLeft: `${item.depth * 16}px` }"
          >
            <span v-if="item.isFile" class="text-default">{{ item.name }}</span>
            <span v-else class="text-default font-semibold">{{ item.name }}/</span>
          </div>
        </div>
        <pre
          v-else
          class="bg-default max-h-64 overflow-x-auto overflow-y-auto rounded p-2 font-mono text-xs"
        ><template v-for="(line, i) in readOutput.lines" :key="i"><span v-if="line.lineNum !== null" class="text-muted select-none mr-2">{{ line.lineNum }}</span>{{ line.text }}
</template></pre>
      </div>

      <div v-if="toolName === 'grep' && grepResults.length > 0" class="p-2">
        <div class="text-muted mb-1 text-xs">{{ grepResults.length }} matches</div>
        <div class="max-h-48 space-y-0.5 overflow-y-auto">
          <div v-for="(r, i) in grepResults" :key="i" class="flex gap-2 font-mono text-xs">
            <span class="text-muted shrink-0">{{ r.file }}:{{ r.lineNum }}</span>
            <span class="text-default truncate">{{ r.content }}</span>
          </div>
        </div>
      </div>

      <div v-if="toolName === 'glob' && globResults.length > 0" class="p-2">
        <div v-for="(group, i) in globResults" :key="i" class="mb-1">
          <div class="text-muted font-mono text-xs">{{ group.dir }}/</div>
          <div class="pl-4">
            <div v-for="file in group.files" :key="file" class="text-default font-mono text-xs">
              {{ file }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="
          isCompleted &&
          output &&
          category !== 'edit' &&
          category !== 'read' &&
          toolName !== 'grep' &&
          toolName !== 'glob'
        "
        class="p-2"
      >
        <pre
          class="bg-default max-h-48 overflow-x-auto overflow-y-auto rounded p-2 font-mono text-xs"
          >{{ truncateOutput(output) }}</pre
        >
      </div>

      <div v-if="isError && error" class="p-2">
        <div class="bg-error/10 text-error rounded p-2 text-xs">{{ error }}</div>
      </div>
    </div>
  </div>
</template>
