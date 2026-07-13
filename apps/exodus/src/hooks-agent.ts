import { ref, shallowRef, computed, onMounted, onUnmounted } from "vue"
import { edem } from "./edem"
import { parseActions, executeAction } from "./agent-actions"

export interface AgentMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: number
}

export interface AgentState {
  listening: boolean
  thinking: boolean
  speaking: boolean
}

export interface AgentSettings {
  active_provider_id: string
  opencode_provider_id: string
  opencode_model_id: string
  voice: string
  language: string
  auto_listen: boolean
  auto_speak: boolean
  show_reasoning: boolean
  volume: number
  tts_voice: string
  tts_speed: number
}

export interface Provider {
  id: string
  name: string
  api_url: string
  api_key: string
  models: string[]
  active_model: string
}

interface OpencodeSession {
  id: string
  title: string
  directory: string
  time: { created: number; updated: number }
}

interface OpencodeMessage {
  info: { id: string; role: "user" | "assistant"; sessionID: string }
  parts: Array<Record<string, unknown>>
}

const DEFAULT_SETTINGS: AgentSettings = {
  active_provider_id: "",
  opencode_provider_id: "",
  opencode_model_id: "",
  voice: "",
  language: "auto",
  auto_listen: false,
  auto_speak: false,
  show_reasoning: false,
  volume: 0.8,
  tts_voice: "",
  tts_speed: 1.0,
}

function parseSettings(data: Record<string, unknown>): AgentSettings {
  return {
    active_provider_id:
      typeof data.active_provider_id === "string"
        ? data.active_provider_id
        : DEFAULT_SETTINGS.active_provider_id,
    opencode_provider_id:
      typeof data.opencode_provider_id === "string"
        ? data.opencode_provider_id
        : DEFAULT_SETTINGS.opencode_provider_id,
    opencode_model_id:
      typeof data.opencode_model_id === "string"
        ? data.opencode_model_id
        : DEFAULT_SETTINGS.opencode_model_id,
    voice: typeof data.voice === "string" ? data.voice : DEFAULT_SETTINGS.voice,
    language: typeof data.language === "string" ? data.language : DEFAULT_SETTINGS.language,
    auto_listen:
      typeof data.auto_listen === "boolean" ? data.auto_listen : DEFAULT_SETTINGS.auto_listen,
    auto_speak:
      typeof data.auto_speak === "boolean" ? data.auto_speak : DEFAULT_SETTINGS.auto_speak,
    show_reasoning:
      typeof data.show_reasoning === "boolean"
        ? data.show_reasoning
        : DEFAULT_SETTINGS.show_reasoning,
    volume: typeof data.volume === "number" ? data.volume : DEFAULT_SETTINGS.volume,
    tts_voice: typeof data.tts_voice === "string" ? data.tts_voice : DEFAULT_SETTINGS.tts_voice,
    tts_speed: typeof data.tts_speed === "number" ? data.tts_speed : DEFAULT_SETTINGS.tts_speed,
  }
}

function parseProvider(item: { id: string; data: Record<string, unknown> }): Provider {
  return {
    id: item.id,
    name: typeof item.data.name === "string" ? item.data.name : "",
    api_url: typeof item.data.api_url === "string" ? item.data.api_url : "",
    api_key: typeof item.data.api_key === "string" ? item.data.api_key : "",
    models: Array.isArray(item.data.models)
      ? (item.data.models as unknown[]).filter((m): m is string => typeof m === "string")
      : [],
    active_model: typeof item.data.active_model === "string" ? item.data.active_model : "",
  }
}

export interface StreamingPart {
  id: string
  type: string
  text?: string
  tool?: string
  state?: Record<string, unknown>
}

export function useAgentChat() {
  const sessions = ref<OpencodeSession[]>([])
  const currentSession = ref<OpencodeSession | null>(null)
  const messages = shallowRef<OpencodeMessage[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const streamingParts = ref<StreamingPart[]>([])

  let unsubEvents: (() => void) | null = null

  async function loadSessions() {
    try {
      sessions.value = await edem.opencode.listSessions({})
    } catch (e) {
      sessions.value = []
      if (!error.value) {
        error.value = e instanceof Error ? e.message : String(e)
      }
    }
  }

  async function loadMessages() {
    if (!currentSession.value) {
      messages.value = []
      return
    }
    try {
      messages.value = await edem.opencode.listMessages({
        session_id: currentSession.value.id,
        limit: 100,
      })
    } catch (e) {
      messages.value = []
      if (!error.value) {
        error.value = e instanceof Error ? e.message : String(e)
      }
    }
  }

  async function createSession(title?: string) {
    try {
      currentSession.value = await edem.opencode.createSession({ title })
      messages.value = []
      await loadSessions()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function switchSession(id: string) {
    try {
      currentSession.value = await edem.opencode.getSession({ id })
      await loadMessages()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function deleteSession(id: string) {
    try {
      await edem.opencode.deleteSession({ id })
      if (currentSession.value?.id === id) {
        currentSession.value = null
        messages.value = []
      }
      await loadSessions()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function startListening() {
    unsubEvents?.()
    const ok = await edem.opencode.startListening({})
    if (!ok) {
      error.value = "OpenCode not running. Start `opencode serve`."
      return
    }
    unsubEvents = edem.opencode.onEvent(({ event }) => {
      const ev = event as { type: string; properties: Record<string, unknown> }
      if (ev.type === "message.part.updated") {
        const part = ev.properties.part as Record<string, unknown> | undefined
        if (!part) return
        const partId = typeof part.id === "string" ? part.id : undefined
        const partType = typeof part.type === "string" ? part.type : "unknown"
        if (!partId) return

        const existingIdx = streamingParts.value.findIndex((p) => p.id === partId)
        const existing = existingIdx >= 0 ? streamingParts.value[existingIdx] : undefined

        if (partType === "text") {
          const delta = ev.properties.delta as string | undefined
          const text = part.text as string | undefined
          const currentText = existing?.text ?? ""
          const newText = delta
            ? currentText + delta
            : typeof text === "string"
              ? text
              : currentText
          const updated: StreamingPart = { id: partId, type: "text", text: newText }
          if (existingIdx >= 0) {
            streamingParts.value = [
              ...streamingParts.value.slice(0, existingIdx),
              updated,
              ...streamingParts.value.slice(existingIdx + 1),
            ]
          } else {
            streamingParts.value = [...streamingParts.value, updated]
          }
        } else if (partType === "tool") {
          const updated: StreamingPart = {
            id: partId,
            type: "tool",
            tool: typeof part.tool === "string" ? part.tool : undefined,
            state: part.state as Record<string, unknown> | undefined,
          }
          if (existingIdx >= 0) {
            streamingParts.value = [
              ...streamingParts.value.slice(0, existingIdx),
              updated,
              ...streamingParts.value.slice(existingIdx + 1),
            ]
          } else {
            streamingParts.value = [...streamingParts.value, updated]
          }
        }
      }
      if (ev.type === "session.idle") {
        loading.value = false
        streamingParts.value = []
        void loadMessages().then(() => {
          const lastAssistant = [...messages.value]
            .toReversed()
            .find((m) => m.info.role === "assistant")
          if (lastAssistant) {
            const text = lastAssistant.parts
              .filter((p: Record<string, unknown>) => p.type === "text")
              .map((p: Record<string, unknown>) => (typeof p.text === "string" ? p.text : ""))
              .join("")
            const actions = parseActions(text)
            for (const action of actions) {
              void executeAction(action, edem)
            }
          }
        })
      }
      if (ev.type === "session.error") {
        loading.value = false
        console.log("[agent] session.error:", JSON.stringify(ev.properties))
        const err = ev.properties.error as
          | { data?: { message?: string }; message?: string }
          | undefined
        error.value = err?.data?.message ?? err?.message ?? JSON.stringify(ev.properties)
        streamingParts.value = []
      }
      if (ev.type === "connection.lost") {
        error.value = "Connection lost. Retrying..."
        setTimeout(() => void startListening(), 3000)
      }
    })
  }

  async function sendMessage(text: string) {
    error.value = null
    loading.value = true
    streamingParts.value = []

    if (!currentSession.value) {
      await createSession(text.slice(0, 50))
      if (!currentSession.value) {
        loading.value = false
        return
      }
    }

    try {
      const settingsResult = await edem.data.getSingleton({ collection_id: "agent_settings" })
      const settings = parseSettings((settingsResult.item?.data ?? {}) as Record<string, unknown>)

      let model: { providerID: string; modelID: string } | undefined

      if (settings.opencode_provider_id && settings.opencode_model_id) {
        model = { providerID: settings.opencode_provider_id, modelID: settings.opencode_model_id }
      }

      if (!model) {
        const { providers } = await edem.opencode.getProviders({})
        for (const p of providers) {
          const models = Object.keys(p.models).filter(
            (m) => !m.includes("tts") && !m.includes("asr") && !m.includes("embed"),
          )
          if (models.length > 0) {
            model = { providerID: p.id, modelID: models[0] }
            break
          }
        }
      }

      if (!model) {
        error.value = "No AI model available. Add a provider in settings."
        loading.value = false
        return
      }

      await edem.opencode.sendPrompt({
        session_id: currentSession.value.id,
        parts: [{ type: "text", text }],
        model,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      error.value = msg
      loading.value = false
      streamingParts.value = []
    }
  }

  async function abortSession() {
    if (currentSession.value) {
      await edem.opencode.abortSession({ id: currentSession.value.id })
      loading.value = false
      streamingParts.value = []
    }
  }

  onMounted(() => {
    startListening()
    void loadSessions()
  })

  onUnmounted(() => {
    unsubEvents?.()
  })

  return {
    sessions,
    currentSession,
    messages,
    loading,
    error,
    streamingParts,
    chatStatus: computed(() => {
      if (streamingParts.value.length > 0) return "streaming" as const
      if (loading.value) return "submitted" as const
      return "ready" as const
    }),
    sendMessage,
    createSession,
    switchSession,
    deleteSession,
    abortSession,
    loadSessions,
    loadMessages,
  }
}

export const agentState = ref<AgentState>({
  listening: false,
  thinking: false,
  speaking: false,
})

export function useAgentVoice() {
  const isListening = ref(false)
  const isRecording = ref(false)
  const isSupported = ref(true)
  const error = ref<string | null>(null)

  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  let stream: MediaStream | null = null

  async function startRecording() {
    error.value = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      audioChunks = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data)
      }

      mediaRecorder.start()
      isRecording.value = true
      isListening.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      isRecording.value = false
      isListening.value = false
    }
  }

  async function stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        resolve(null)
        return
      }
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" })
        cleanup()
        resolve(audioBlob)
      }
      mediaRecorder.stop()
      isRecording.value = false
      isListening.value = false
    })
  }

  function cleanup() {
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      stream = null
    }
    mediaRecorder = null
    audioChunks = []
  }

  onUnmounted(cleanup)

  return { isSupported, isRecording, isListening, error, startRecording, stopRecording }
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const settingsResult = await edem.data.getSingleton({ collection_id: "agent_settings" })
  const settings = parseSettings((settingsResult.item?.data ?? {}) as Record<string, unknown>)

  if (!settings.active_provider_id) throw new Error("No active provider")

  const providersResult = await edem.data.queryItems({ collection_id: "agent_providers" })
  const found = providersResult.items.find((p) => p.id === settings.active_provider_id)
  if (!found) throw new Error("Provider not found")

  const provider = parseProvider(found)
  if (!provider.api_url || !provider.api_key) throw new Error("Provider not configured")

  const buffer = await blob.arrayBuffer()
  const base64 = btoa(
    Array.from(new Uint8Array(buffer))
      .map((b) => String.fromCharCode(b))
      .join(""),
  )

  const baseUrl = provider.api_url.replace(/\/v1\/?$/, "").replace(/\/$/, "")
  const result = await edem.net.request({
    method: "POST",
    url: `${baseUrl}/v1/chat/completions`,
    headers: {
      "Content-Type": "application/json",
      "api-key": provider.api_key,
    },
    body: {
      model: "mimo-v2.5-asr",
      messages: [
        {
          role: "user",
          content: [
            { type: "input_audio", input_audio: { data: `data:${blob.type};base64,${base64}` } },
          ],
        },
      ],
      asr_options: { language: settings.language === "auto" ? "auto" : settings.language },
    },
  })

  const parsed = JSON.parse(result.body) as { choices?: { message?: { content?: string } }[] }
  return parsed.choices?.[0]?.message?.content ?? ""
}

function pcmToWav(pcmBase64: string): string {
  const pcmBinary = atob(pcmBase64)
  const pcmLen = pcmBinary.length
  const sampleRate = 22050
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const headerLen = 44
  const buf = new ArrayBuffer(headerLen + pcmLen)
  const view = new DataView(buf)

  function writeStr(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, "RIFF")
  view.setUint32(4, 36 + pcmLen, true)
  writeStr(8, "WAVE")
  writeStr(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeStr(36, "data")
  view.setUint32(40, pcmLen, true)

  const uint8 = new Uint8Array(buf)
  for (let i = 0; i < pcmLen; i++) uint8[headerLen + i] = pcmBinary.charCodeAt(i)

  let binary = ""
  const chunkSize = 8192
  for (let i = 0; i < uint8.length; i += chunkSize) {
    const chunk = uint8.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk as unknown as number[])
  }
  return btoa(binary)
}

export function useAgentSpeech() {
  const isSpeaking = ref(false)
  const audioElement = ref<HTMLAudioElement | null>(null)

  async function speak(text: string, volume?: number) {
    try {
      const settingsResult = await edem.data.getSingleton({ collection_id: "agent_settings" })
      const settings = parseSettings((settingsResult.item?.data ?? {}) as Record<string, unknown>)

      const result = await edem.tts.synthesize({
        text,
        voice_id: settings.tts_voice,
        speed: settings.tts_speed,
      })

      stop()

      const wavBase64 = pcmToWav(result.audio)
      const audio = new Audio(`data:audio/wav;base64,${wavBase64}`)
      audio.volume = volume ?? settings.volume
      audioElement.value = audio

      audio.addEventListener("play", () => {
        isSpeaking.value = true
      })
      audio.addEventListener("ended", () => {
        isSpeaking.value = false
        audioElement.value = null
      })
      audio.addEventListener("error", () => {
        isSpeaking.value = false
        audioElement.value = null
      })

      await audio.play()
    } catch (err) {
      console.error("[TTS] failed:", err)
      isSpeaking.value = false
    }
  }

  function stop() {
    if (audioElement.value) {
      audioElement.value.pause()
      audioElement.value.currentTime = 0
      audioElement.value = null
    }
    isSpeaking.value = false
  }

  return { isSpeaking, speak, stop }
}

const _agentSettings = ref<AgentSettings>({ ...DEFAULT_SETTINGS })
const _agentSettingsLoading = ref(false)
const _agentSettingsSaved = ref<string | null>(null)
let _agentSettingsTimer: ReturnType<typeof setTimeout> | null = null
let _agentSettingsLoaded = false

export function useAgentSettings() {
  async function loadSettings() {
    if (_agentSettingsLoaded) return
    _agentSettingsLoaded = true
    try {
      const result = await edem.data.getSingleton({ collection_id: "agent_settings" })
      if (result.item?.data) {
        _agentSettings.value = parseSettings(result.item.data as Record<string, unknown>)
      }
    } catch {
      // defaults
    }
  }

  async function updateSettings(partial: Partial<AgentSettings>) {
    _agentSettingsLoading.value = true
    try {
      const current = { ..._agentSettings.value, ...partial }
      await edem.data.updateSingleton({
        collection_id: "agent_settings",
        data: current as unknown as Record<string, unknown>,
      })
      _agentSettings.value = current
      _agentSettingsSaved.value = Object.keys(partial)[0] ?? "settings"

      if (_agentSettingsTimer) clearTimeout(_agentSettingsTimer)
      _agentSettingsTimer = setTimeout(() => {
        _agentSettingsSaved.value = null
      }, 2000)
    } finally {
      _agentSettingsLoading.value = false
    }
  }

  onMounted(loadSettings)

  return {
    settings: _agentSettings,
    loading: _agentSettingsLoading,
    savedField: _agentSettingsSaved,
    updateSettings,
    loadSettings,
  }
}

export interface OpencodeProvider {
  id: string
  name: string
  models: string[]
}

export function useOpencodeModels() {
  const providers = ref<OpencodeProvider[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const result = await edem.opencode.getProviders({})
      providers.value = result.providers.map((p) => ({
        id: p.id,
        name: p.name,
        models: Object.keys(p.models).filter(
          (m) => !m.includes("tts") && !m.includes("asr") && !m.includes("embed"),
        ),
      }))
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  return { providers, loading, error, reload: load }
}

export async function testProviderConnection(
  id: string,
): Promise<{ ok: boolean; url: string; error?: string }> {
  try {
    const { items } = await edem.data.queryItems({ collection_id: "agent_providers" })
    const found = items.find((p) => p.id === id)
    if (!found) return { ok: false, url: "", error: "Provider not found" }

    const provider = parseProvider(found)
    const baseUrl = provider.api_url.replace(/\/v1\/?$/, "").replace(/\/$/, "")
    const url = `${baseUrl}/v1/chat/completions`

    const result = await edem.net.request({
      method: "POST",
      url,
      headers: {
        "Content-Type": "application/json",
        "api-key": provider.api_key,
      },
      body: {
        model: provider.active_model || "gpt-3.5-turbo",
        messages: [{ role: "user", content: "hi" }],
        max_completion_tokens: 5,
      },
    })

    if (result.status >= 400) {
      return { ok: false, url, error: `${result.status}: ${result.body.slice(0, 200)}` }
    }

    return { ok: true, url }
  } catch (e) {
    return { ok: false, url: "", error: e instanceof Error ? e.message : String(e) }
  }
}

async function syncProviderToOpencode(provider: Provider) {
  try {
    await edem.opencode.syncProvider({
      id: provider.id,
      api_url: provider.api_url,
      api_key: provider.api_key,
      models: provider.models,
    })
  } catch {
    // silent — opencode may not be running
  }
}

export function useProviders() {
  const providers = ref<Provider[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const { settings, updateSettings } = useAgentSettings()

  async function loadProviders() {
    loading.value = true
    error.value = null
    try {
      const result = await edem.data.queryItems({ collection_id: "agent_providers" })
      providers.value = result.items.map(parseProvider)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function addProvider(name: string, apiUrl: string, apiKey: string) {
    try {
      await edem.data.createItem({
        collection_id: "agent_providers",
        data: { name, api_url: apiUrl, api_key: apiKey, models: [], active_model: "" },
      })
      await loadProviders()
      const added = providers.value.find((p) => p.api_url === apiUrl)
      if (added) await syncProviderToOpencode(added)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function removeProvider(id: string) {
    try {
      await edem.data.deleteItem({ item_id: id })
      if (settings.value.active_provider_id === id) {
        await updateSettings({ active_provider_id: "" })
      }
      await edem.opencode.removeProvider({ id }).catch(() => {})
      await loadProviders()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function updateProvider(
    id: string,
    fields: { name?: string; api_url?: string; api_key?: string; active_model?: string },
  ) {
    try {
      await edem.data.updateItem({ item_id: id, data: fields as Record<string, unknown> })
      await loadProviders()
      const updated = providers.value.find((p) => p.id === id)
      if (updated) await syncProviderToOpencode(updated)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function fetchModels(id: string): Promise<string[]> {
    try {
      const { items } = await edem.data.queryItems({ collection_id: "agent_providers" })
      const found = items.find((p) => p.id === id)
      if (!found) return []

      const provider = parseProvider(found)
      if (!provider.api_url || !provider.api_key) return []

      const baseUrl = provider.api_url.replace(/\/v1\/?$/, "").replace(/\/$/, "")
      const result = await edem.net.request({
        method: "GET",
        url: `${baseUrl}/v1/models`,
        headers: { "api-key": provider.api_key },
      })

      const parsed = JSON.parse(result.body) as { data?: { id?: string }[] }
      const apiModels = (parsed.data ?? []).map((m) => m.id ?? "").filter(Boolean)
      const merged = [...new Set([...provider.models, ...apiModels])]

      await edem.data.updateItem({ item_id: id, data: { models: merged } })
      await loadProviders()
      const updated = providers.value.find((p) => p.id === id)
      if (updated) await syncProviderToOpencode(updated)
      return merged
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return []
    }
  }

  function setActiveProvider(id: string) {
    updateSettings({ active_provider_id: id })
  }

  function setActiveModel(providerId: string, model: string) {
    updateProvider(providerId, { active_model: model })
  }

  const activeProvider = computed(
    () => providers.value.find((p) => p.id === settings.value.active_provider_id) ?? null,
  )

  onMounted(loadProviders)

  return {
    providers,
    activeProvider,
    loading,
    error,
    loadProviders,
    addProvider,
    removeProvider,
    updateProvider,
    fetchModels,
    testConnection: testProviderConnection,
    setActiveProvider,
    setActiveModel,
  }
}

export interface TTSVoice {
  id: string
  name: string
  lang: string
  gender: string
  size: number
  downloaded: boolean
}

export function useTTSVoices() {
  const voices = ref<TTSVoice[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const downloadingVoiceId = ref<string | null>(null)

  async function fetchVoices() {
    loading.value = true
    error.value = null
    try {
      const result = await edem.tts.listVoices({})
      voices.value = result.voices
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      voices.value = []
    } finally {
      loading.value = false
    }
  }

  async function downloadVoice(voiceId: string) {
    downloadingVoiceId.value = voiceId
    error.value = null
    try {
      await edem.tts.downloadVoice({ voice_id: voiceId })
      await fetchVoices()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      downloadingVoiceId.value = null
    }
  }

  async function deleteVoice(voiceId: string) {
    downloadingVoiceId.value = voiceId
    error.value = null
    try {
      await edem.tts.deleteVoice({ voice_id: voiceId })
      await fetchVoices()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      downloadingVoiceId.value = null
    }
  }

  onMounted(fetchVoices)

  return { voices, loading, error, downloadingVoiceId, fetchVoices, downloadVoice, deleteVoice }
}

export { formatToolInput, cleanText, extractTextFromParts } from "./agent-format"
