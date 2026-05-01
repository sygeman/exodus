import { createHash } from "node:crypto"
import { join } from "node:path"
import { mkdir, readFile, writeFile, unlink, stat } from "node:fs/promises"

export interface FileStorageOptions {
  baseDir: string
}

export interface StoredFile {
  hash: string
  size: number
  path: string
}

export function createFileStorage(options: FileStorageOptions) {
  const { baseDir } = options

  async function ensureDir(dir: string): Promise<void> {
    await mkdir(dir, { recursive: true })
  }

  function getFilePath(hash: string): string {
    const prefix = hash.slice(0, 2)
    const suffix = hash.slice(2, 4)
    return join(baseDir, prefix, suffix, hash)
  }

  async function put(data: Buffer): Promise<StoredFile> {
    const hash = createHash("sha256").update(data).digest("hex")
    const filePath = getFilePath(hash)

    await ensureDir(join(baseDir, hash.slice(0, 2), hash.slice(2, 4)))
    await writeFile(filePath, data)

    return {
      hash,
      size: data.length,
      path: filePath,
    }
  }

  async function get(hash: string): Promise<Buffer | null> {
    const filePath = getFilePath(hash)
    try {
      return await readFile(filePath)
    } catch {
      return null
    }
  }

  async function exists(hash: string): Promise<boolean> {
    const filePath = getFilePath(hash)
    try {
      await stat(filePath)
      return true
    } catch {
      return false
    }
  }

  async function remove(hash: string): Promise<boolean> {
    const filePath = getFilePath(hash)
    try {
      await unlink(filePath)
      return true
    } catch {
      return false
    }
  }

  return { put, get, exists, remove }
}
