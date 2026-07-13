<script setup lang="ts">
import { computed } from "vue"
import { useT } from "@exodus/edem-vue"
import { useAgentSettings, useAgentSpeech, useTTSVoices, useOpencodeModels } from "@/hooks-agent"

const t = useT()
const { settings, updateSettings } = useAgentSettings()
const { isSpeaking, speak } = useAgentSpeech()
const {
  voices,
  loading: voicesLoading,
  downloadingVoiceId,
  fetchVoices,
  downloadVoice,
  deleteVoice,
} = useTTSVoices()
const { providers: ocProviders, loading: ocLoading } = useOpencodeModels()

const selectedOcProvider = computed(() =>
  ocProviders.value.find((p) => p.id === settings.value.opencode_provider_id),
)

const ocProviderItems = computed(() =>
  ocProviders.value.map((p) => ({ label: p.name, value: p.id })),
)

const ocModelItems = computed(() =>
  (selectedOcProvider.value?.models ?? []).map((m) => ({ label: m, value: m })),
)

const languageModel = computed({
  get: () => settings.value.language,
  set: (v: string) => updateSettings({ language: v }),
})

const autoListenModel = computed({
  get: () => settings.value.auto_listen,
  set: (v: boolean) => updateSettings({ auto_listen: v }),
})

const volumeModel = computed({
  get: () => settings.value.volume,
  set: (v: number) => updateSettings({ volume: Number(v) }),
})

const ttsVoiceModel = computed({
  get: () => settings.value.tts_voice,
  set: (v: string) => updateSettings({ tts_voice: v }),
})

const ttsSpeedModel = computed({
  get: () => settings.value.tts_speed,
  set: (v: number) => updateSettings({ tts_speed: Number(v) }),
})

const voiceItems = computed(() => {
  return voices.value
    .filter((v) => v.downloaded)
    .map((v) => ({
      label: `${v.name} (${v.gender === "male" ? "М" : "Ж"})`,
      value: v.id,
    }))
})

const downloadedVoices = computed(() => voices.value.filter((v) => v.downloaded))
const availableVoices = computed(() => voices.value.filter((v) => !v.downloaded))
</script>

<template>
  <section class="flex flex-col gap-8">
    <!-- Chat Model -->
    <div class="flex flex-col gap-4">
      <h3 class="text-default text-sm font-medium">
        {{ t({ en: "Chat Model", ru: "Модель чата" }) }}
      </h3>

      <div class="flex flex-col gap-1.5">
        <label class="text-muted text-xs">
          {{ t({ en: "Provider", ru: "Провайдер" }) }}
        </label>
        <USelect
          :model-value="settings.opencode_provider_id"
          :items="ocProviderItems"
          :loading="ocLoading"
          size="sm"
          :placeholder="t({ en: 'Select provider...', ru: 'Выберите провайдер...' })"
          @update:model-value="
            updateSettings({ opencode_provider_id: $event, opencode_model_id: '' })
          "
        />
      </div>

      <div v-if="selectedOcProvider && ocModelItems.length > 0" class="flex flex-col gap-1.5">
        <label class="text-muted text-xs">
          {{ t({ en: "Model", ru: "Модель" }) }}
        </label>
        <USelect
          :model-value="settings.opencode_model_id"
          :items="ocModelItems"
          size="sm"
          :placeholder="t({ en: 'Select model...', ru: 'Выберите модель...' })"
          @update:model-value="updateSettings({ opencode_model_id: $event })"
        />
      </div>
    </div>

    <!-- Voice -->
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h3 class="text-default text-sm font-medium">
          {{ t({ en: "TTS Voice", ru: "Голос TTS" }) }}
        </h3>
        <UButton
          variant="ghost"
          color="neutral"
          size="xs"
          icon="i-lucide-refresh-cw"
          :loading="voicesLoading"
          @click="fetchVoices"
        />
      </div>

      <USelect
        v-model="ttsVoiceModel"
        :items="voiceItems"
        size="sm"
        :placeholder="t({ en: 'No voices downloaded', ru: 'Нет скачанных голосов' })"
      />

      <div v-if="downloadedVoices.length > 0" class="flex flex-wrap gap-1.5">
        <div
          v-for="voice in downloadedVoices"
          :key="voice.id"
          class="bg-elevated flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs"
        >
          <span>{{ voice.name }}</span>
          <span class="text-muted">{{ voice.gender === "male" ? "М" : "Ж" }}</span>
          <UButton
            variant="ghost"
            color="error"
            size="xs"
            icon="i-lucide-trash-2"
            :loading="downloadingVoiceId === voice.id"
            @click="deleteVoice(voice.id)"
          />
        </div>
      </div>

      <div v-if="availableVoices.length > 0" class="flex flex-col gap-2">
        <span class="text-muted text-xs">
          {{ t({ en: "Download:", ru: "Скачать:" }) }}
        </span>
        <div class="flex flex-wrap gap-1.5">
          <UButton
            v-for="voice in availableVoices"
            :key="voice.id"
            variant="outline"
            size="xs"
            :loading="downloadingVoiceId === voice.id"
            @click="downloadVoice(voice.id)"
          >
            {{ voice.name }} ({{ voice.size }}MB)
          </UButton>
        </div>
      </div>
    </div>

    <!-- Speech -->
    <div class="flex flex-col gap-4">
      <h3 class="text-default text-sm font-medium">
        {{ t({ en: "Speech", ru: "Речь" }) }}
      </h3>

      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-default text-sm">{{ t({ en: "Speed", ru: "Скорость" }) }}</span>
          <span class="text-muted text-xs tabular-nums">{{ ttsSpeedModel.toFixed(1) }}x</span>
        </div>
        <USlider v-model="ttsSpeedModel" :min="0.5" :max="2.0" :step="0.1" />
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-default text-sm">{{ t({ en: "Volume", ru: "Громкость" }) }}</span>
          <span class="text-muted text-xs tabular-nums">{{ Math.round(volumeModel * 100) }}%</span>
        </div>
        <USlider v-model="volumeModel" :min="0" :max="1" :step="0.01" />
      </div>

      <UButton
        size="sm"
        variant="outline"
        icon="i-lucide-volume-2"
        :loading="isSpeaking"
        @click="
          speak(
            t({ en: 'Hello! I am your AI assistant.', ru: 'Привет! Я ваш AI ассистент.' }),
            volumeModel,
          )
        "
      >
        {{ t({ en: "Test Voice", ru: "Тест голоса" }) }}
      </UButton>

      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-0.5">
          <span class="text-default text-sm">{{ t({ en: "Language", ru: "Язык" }) }}</span>
          <span class="text-muted text-xs">
            {{ t({ en: "For speech recognition", ru: "Для распознавания речи" }) }}
          </span>
        </div>
        <USelect
          v-model="languageModel"
          :items="[
            { label: t({ en: 'Русский', ru: 'Русский' }), value: 'ru-RU' },
            { label: 'English', value: 'en-US' },
            { label: '中文', value: 'zh-CN' },
            { label: t({ en: 'Auto', ru: 'Авто' }), value: 'auto' },
          ]"
          size="sm"
          class="w-36"
        />
      </div>

      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-0.5">
          <span class="text-default text-sm">
            {{ t({ en: "Auto-listen", ru: "Автопрослушивание" }) }}
          </span>
          <span class="text-muted text-xs">
            {{
              t({
                en: "Record after agent responds",
                ru: "Запись после ответа агента",
              })
            }}
          </span>
        </div>
        <USwitch v-model="autoListenModel" />
      </div>
    </div>
  </section>
</template>
