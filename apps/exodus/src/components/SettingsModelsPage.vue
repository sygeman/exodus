<script setup lang="ts">
import { ref } from "vue"
import { useT } from "@exodus/edem-vue"
import { useProviders, useAgentSettings } from "@/hooks-agent"

const t = useT()
const { settings } = useAgentSettings()
const {
  providers,
  loading,
  addProvider,
  removeProvider,
  fetchModels,
  testConnection,
  setActiveProvider,
  setActiveModel,
} = useProviders()

const newName = ref("")
const newUrl = ref("")
const newKey = ref("")
const showKey = ref(false)
const showAddForm = ref(false)
const testingId = ref<string | null>(null)
const testResult = ref<{ ok: boolean; error?: string } | null>(null)
const fetchingId = ref<string | null>(null)

async function handleAdd() {
  const name = newName.value.trim()
  const url = newUrl.value.trim()
  const key = newKey.value.trim()
  if (!name || !url) return
  await addProvider(name, url, key)
  newName.value = ""
  newUrl.value = ""
  newKey.value = ""
  showAddForm.value = false
}

async function handleTest(id: string) {
  testingId.value = id
  testResult.value = null
  testResult.value = await testConnection(id)
  testingId.value = null
}

async function handleFetch(id: string) {
  fetchingId.value = id
  await fetchModels(id)
  fetchingId.value = null
}

function maskedKey(key: string) {
  if (!key) return ""
  if (key.length <= 8) return "••••••••"
  return key.slice(0, 4) + "••••" + key.slice(-4)
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <!-- Provider list -->
    <div v-for="provider in providers" :key="provider.id" class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button
            class="text-default text-sm font-medium transition-colors"
            :class="{
              'text-primary': provider.id === settings.active_provider_id,
              'text-muted hover:text-default': provider.id !== settings.active_provider_id,
            }"
            @click="setActiveProvider(provider.id)"
          >
            {{ provider.name }}
          </button>
          <span
            v-if="provider.id === settings.active_provider_id"
            class="text-primary bg-primary/10 rounded px-1.5 py-0.5 text-xs"
          >
            {{ t({ en: "active", ru: "активен" }) }}
          </span>
        </div>
        <div class="flex items-center gap-1">
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-zap"
            :loading="testingId === provider.id"
            @click="handleTest(provider.id)"
          />
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-refresh-cw"
            :loading="fetchingId === provider.id"
            @click="handleFetch(provider.id)"
          />
          <UButton
            variant="ghost"
            color="error"
            size="xs"
            icon="i-lucide-trash-2"
            @click="removeProvider(provider.id)"
          />
        </div>
      </div>

      <div class="text-muted flex items-center gap-3 text-xs">
        <span>{{ provider.api_url }}</span>
        <span v-if="provider.api_key">{{ maskedKey(provider.api_key) }}</span>
      </div>

      <div v-if="testResult && testingId === null" class="text-xs">
        <span v-if="testResult.ok" class="text-success">
          <UIcon name="i-lucide-check-circle" class="inline h-3 w-3" />
          {{ t({ en: "Connected", ru: "Подключено" }) }}
        </span>
        <span v-else-if="testResult.error" class="text-error">{{ testResult.error }}</span>
      </div>

      <div v-if="provider.models.length > 0" class="flex flex-col gap-1.5">
        <USelect
          :model-value="provider.active_model"
          :items="provider.models.map((m) => ({ label: m, value: m }))"
          size="sm"
          :placeholder="t({ en: 'Select model...', ru: 'Выберите модель...' })"
          @update:model-value="setActiveModel(provider.id, $event)"
        />
      </div>
      <p v-else class="text-muted text-xs">
        {{
          t({
            en: "No models loaded. Click refresh to fetch.",
            ru: "Нет моделей. Нажмите обновить для загрузки.",
          })
        }}
      </p>
    </div>

    <div v-if="providers.length === 0 && !loading" class="text-muted text-sm">
      {{
        t({
          en: "No providers configured.",
          ru: "Нет настроенных провайдеров.",
        })
      }}
    </div>

    <div class="border-default border-t" />

    <!-- Add form -->
    <div v-if="showAddForm" class="flex flex-col gap-3">
      <UInput
        v-model="newName"
        :placeholder="t({ en: 'Provider name', ru: 'Название провайдера' })"
        size="sm"
      />
      <UInput v-model="newUrl" placeholder="https://api.example.com/v1" size="sm" />
      <div class="flex gap-1.5">
        <UInput
          v-model="newKey"
          :type="showKey ? 'text' : 'password'"
          placeholder="sk-..."
          size="sm"
          class="flex-1"
        />
        <UButton
          size="sm"
          variant="ghost"
          color="neutral"
          :icon="showKey ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          @click="showKey = !showKey"
        />
      </div>
      <div class="flex gap-2">
        <UButton size="sm" :disabled="!newName.trim() || !newUrl.trim()" @click="handleAdd">
          {{ t({ en: "Add", ru: "Добавить" }) }}
        </UButton>
        <UButton size="sm" variant="ghost" @click="showAddForm = false">
          {{ t({ en: "Cancel", ru: "Отмена" }) }}
        </UButton>
      </div>
    </div>

    <UButton v-else size="sm" variant="outline" icon="i-lucide-plus" @click="showAddForm = true">
      {{ t({ en: "Add Provider", ru: "Добавить провайдер" }) }}
    </UButton>
  </section>
</template>
