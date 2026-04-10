import type { ComputedRef } from 'vue'
import type { ACSDNode } from '~/types/acsd'

interface MockVersion {
  version: number
  text: string
  level: string | null
  type: string | null
  edges: string[]
  isCurrent: boolean
}

interface Suggestion {
  text: string
  level: string
  type: string
  edges: string[]
}

interface ExampleSuggestion {
  text: string
  level: string
  type: string
  edges: string[]
}

const mockExamples: ExampleSuggestion[] = [
  {
    text: 'OAuth 2.0 авторизация через внешних провайдеров (Google, GitHub)',
    level: 'L2',
    type: 'specification',
    edges: ['requires → L1 Auth', 'requires → L2 External Providers'],
  },
  {
    text: 'POST /auth/oauth/callback — endpoint для обработки callback',
    level: 'L3',
    type: 'contract',
    edges: ['implements → L2 OAuth авторизация', 'requires → L2 Token Storage'],
  },
  {
    text: 'Реализация OAuth2Strategy с passport.js',
    level: 'L4',
    type: 'code',
    edges: ['implements → L3 OAuth callback endpoint'],
  },
]

export function useIntentEditor(
  projectId: string,
  graphNodes: ComputedRef<ACSDNode[]>,
  editingNodeId: ComputedRef<string | null>,
) {
  const intentInput = ref('')
  const mockLoading = ref(false)
  const mockSuggestion = ref<Suggestion | null>(null)

  const mockCurrentNode = computed(() => {
    const node = editingNodeId.value
      ? graphNodes.value.find(n => n.id === editingNodeId.value)
      : null

    return {
      text: node?.text || 'авторизация',
      level: node?.level || null,
      type: node?.type || null,
      edges: [] as string[],
    }
  })

  const mockHistory = ref<MockVersion[]>([])

  watch(editingNodeId, (nodeId) => {
    const node = nodeId ? graphNodes.value.find(n => n.id === nodeId) : null
    mockHistory.value = [
      {
        version: 1,
        text: node?.text || 'авторизация',
        level: node?.level || null,
        type: node?.type || null,
        edges: [] as string[],
        isCurrent: true,
      },
    ]
    mockSuggestion.value = null
    intentInput.value = ''
  })

  function mockSuggest() {
    if (!intentInput.value.trim()) return

    mockLoading.value = true

    $fetch(`/api/control/projects/${projectId}/cascade/suggest`, {
      method: 'POST',
      body: {
        nodeId: editingNodeId.value!,
        userInput: intentInput.value,
      },
    })
      .then((r: any) => {
        if (!r.success) throw new Error(r.error)
        mockSuggestion.value = r.data
        intentInput.value = ''
      })
      .catch((error) => {
        console.error('Suggest failed:', error)
      })
      .finally(() => {
        mockLoading.value = false
      })
  }

  function mockAccept(suggestion?: Suggestion) {
    const target = suggestion || mockSuggestion.value
    if (!target) return

    const currentVersion = mockHistory.value.find(v => v.isCurrent)
    if (currentVersion) {
      currentVersion.isCurrent = false
    }

    const newVersion: MockVersion = {
      version: mockHistory.value.length + 1,
      text: target.text,
      level: target.level,
      type: target.type,
      edges: target.edges,
      isCurrent: true,
    }

    mockHistory.value.push(newVersion)
    mockSuggestion.value = null
  }

  function mockRevert(version: MockVersion) {
    const currentVersion = mockHistory.value.find(v => v.isCurrent)
    if (currentVersion) {
      currentVersion.isCurrent = false
    }

    version.isCurrent = true
  }

  function resetOnNodeChange() {
    mockHistory.value = []
    mockSuggestion.value = null
    intentInput.value = ''
  }

  return {
    intentInput,
    mockLoading,
    mockSuggestion,
    mockCurrentNode,
    mockHistory,
    mockExamples,
    mockSuggest,
    mockAccept,
    mockRevert,
    resetOnNodeChange,
  }
}
