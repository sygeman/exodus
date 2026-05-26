import { onUnmounted, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue"
import type { EdemData } from "./types"

type ThumbnailSize = "small" | "medium" | "large"

type FileChunk = {
  data_base64: string
  offset: number
  length: number
  total: number
  done: boolean
  mime_type: string
  original_name: string
}

type ReadFileBlobInput = {
  hash: string
  chunkSize?: number
  thumbnailSize?: ThumbnailSize
}

type ReadFileBlobResult = {
  blob: Blob
  mimeType: string
  originalName: string
  size: number
}

type FileObjectUrlOptions = {
  chunkSize?: number
  thumbnailSize?: ThumbnailSize
  immediate?: boolean
}

const defaultChunkSize = 256 * 1024
const maxChunkSize = 1024 * 1024

function normalizeChunkSize(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return defaultChunkSize
  return Math.max(1, Math.min(Math.floor(value), maxChunkSize))
}

function decodeBase64(data: string): ArrayBuffer {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }

  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

async function readChunk(
  data: EdemData,
  input: { hash: string; offset: number; length: number; thumbnailSize?: ThumbnailSize },
): Promise<FileChunk> {
  if (input.thumbnailSize) {
    return await data.readThumbnailChunk({
      file_hash: input.hash,
      size: input.thumbnailSize,
      offset: input.offset,
      length: input.length,
    })
  }

  return await data.readFileChunk({
    hash: input.hash,
    offset: input.offset,
    length: input.length,
  })
}

export async function readFileBlob(
  data: EdemData,
  input: ReadFileBlobInput,
): Promise<ReadFileBlobResult> {
  const chunkSize = normalizeChunkSize(input.chunkSize)
  const chunks: ArrayBuffer[] = []
  let offset = 0
  let mimeType = "application/octet-stream"
  let originalName = input.hash
  let size = 0

  while (true) {
    const chunk = await readChunk(data, {
      hash: input.hash,
      offset,
      length: chunkSize,
      thumbnailSize: input.thumbnailSize,
    })

    chunks.push(decodeBase64(chunk.data_base64))
    mimeType = chunk.mime_type
    originalName = chunk.original_name
    size = chunk.total
    offset += chunk.length

    if (chunk.done) {
      break
    }

    if (chunk.length === 0) {
      throw new Error(`File chunk reader made no progress at offset ${chunk.offset}`)
    }
  }

  return {
    blob: new Blob(chunks, { type: mimeType }),
    mimeType,
    originalName,
    size,
  }
}

export function useFileObjectUrl(
  data: EdemData,
  hash: MaybeRefOrGetter<string | null | undefined>,
  options: FileObjectUrlOptions = {},
) {
  const url = shallowRef<string | null>(null)
  const blob = shallowRef<Blob | null>(null)
  const mimeType = ref<string | null>(null)
  const originalName = ref<string | null>(null)
  const size = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let requestId = 0

  function revoke(): void {
    if (url.value) {
      URL.revokeObjectURL(url.value)
      url.value = null
    }
  }

  async function load(): Promise<void> {
    const currentHash = toValue(hash)
    const currentRequestId = ++requestId

    revoke()
    blob.value = null
    mimeType.value = null
    originalName.value = null
    size.value = 0

    if (!currentHash) {
      loading.value = false
      error.value = null
      return
    }

    loading.value = true
    error.value = null

    try {
      const result = await readFileBlob(data, {
        hash: currentHash,
        chunkSize: options.chunkSize,
        thumbnailSize: options.thumbnailSize,
      })

      if (currentRequestId !== requestId) {
        return
      }

      blob.value = result.blob
      mimeType.value = result.mimeType
      originalName.value = result.originalName
      size.value = result.size
      url.value = URL.createObjectURL(result.blob)
    } catch (cause) {
      if (currentRequestId !== requestId) {
        return
      }

      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      if (currentRequestId === requestId) {
        loading.value = false
      }
    }
  }

  watch(
    () => toValue(hash),
    () => {
      if (options.immediate !== false) {
        void load()
      }
    },
    { immediate: options.immediate !== false },
  )

  onUnmounted(() => {
    requestId += 1
    revoke()
  })

  return {
    url,
    blob,
    mimeType,
    originalName,
    size,
    loading,
    error,
    reload: load,
    revoke,
  }
}
