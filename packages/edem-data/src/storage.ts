import { createHash } from "node:crypto"
import { join } from "node:path"
import { mkdir } from "node:fs/promises"

export interface FileStorageOptions {
  baseDir: string
}

export interface StoredFile {
  hash: string
  size: number
  path: string
}

export type FileStorageInput = ArrayBuffer | Blob | Buffer | Uint8Array

const sha256Regex = /^[a-f0-9]{64}$/

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

async function toBytes(data: FileStorageInput): Promise<Uint8Array> {
  if (data instanceof Blob) {
    return new Uint8Array(await data.arrayBuffer())
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data)
  }

  return data
}

async function hashFile(file: Blob): Promise<string> {
  const hash = createHash("sha256")
  const reader = file.stream().getReader()

  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      hash.update(result.value)
    }
  } finally {
    reader.releaseLock()
  }

  return hash.digest("hex")
}

export function createFileStorage(options: FileStorageOptions) {
  const { baseDir } = options

  function getFilePath(hash: string): string {
    if (!sha256Regex.test(hash)) {
      throw new Error(`Invalid file hash "${hash}"`)
    }

    const prefix = hash.slice(0, 2)
    const suffix = hash.slice(2, 4)
    return join(baseDir, prefix, suffix, hash)
  }

  async function put(data: FileStorageInput): Promise<StoredFile> {
    const bytes = await toBytes(data)
    const hash = createHash("sha256").update(bytes).digest("hex")
    const filePath = getFilePath(hash)

    await ensureDir(join(baseDir, hash.slice(0, 2), hash.slice(2, 4)))
    await Bun.write(filePath, bytes)

    return {
      hash,
      size: bytes.byteLength,
      path: filePath,
    }
  }

  async function putFile(sourcePath: string): Promise<StoredFile> {
    const file = Bun.file(sourcePath)
    if (!(await file.exists())) {
      throw new Error(`File "${sourcePath}" not found`)
    }

    const hash = await hashFile(file)
    const filePath = getFilePath(hash)

    await ensureDir(join(baseDir, hash.slice(0, 2), hash.slice(2, 4)))
    if (!(await Bun.file(filePath).exists())) {
      await Bun.write(filePath, file)
    }

    return {
      hash,
      size: file.size,
      path: filePath,
    }
  }

  async function get(hash: string): Promise<Buffer | null> {
    if (!sha256Regex.test(hash)) {
      return null
    }

    const filePath = getFilePath(hash)
    try {
      return Buffer.from(await Bun.file(filePath).arrayBuffer())
    } catch {
      return null
    }
  }

  async function exists(hash: string): Promise<boolean> {
    if (!sha256Regex.test(hash)) {
      return false
    }

    return await Bun.file(getFilePath(hash)).exists()
  }

  async function remove(hash: string): Promise<boolean> {
    if (!sha256Regex.test(hash)) {
      return false
    }

    const filePath = getFilePath(hash)
    try {
      await Bun.file(filePath).delete()
      return true
    } catch {
      return false
    }
  }

  return { put, putFile, get, exists, remove, path: getFilePath }
}
