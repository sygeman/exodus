import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createFileStorage } from "./storage"

describe("createFileStorage", () => {
  let tempDir: string
  let storage: ReturnType<typeof createFileStorage>

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "edem-storage-"))
    storage = createFileStorage({ baseDir: tempDir })
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  describe("put", () => {
    it("should store a buffer and return hash, size, path", async () => {
      const data = Buffer.from("hello world")
      const result = await storage.put(data)

      expect(result.size).toBe(data.length)
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/)
      expect(result.path).toContain(result.hash)
    })

    it("should produce same hash for same content", async () => {
      const a = await storage.put(Buffer.from("same content"))
      const b = await storage.put(Buffer.from("same content"))
      expect(a.hash).toBe(b.hash)
    })

    it("should produce different hashes for different content", async () => {
      const a = await storage.put(Buffer.from("content A"))
      const b = await storage.put(Buffer.from("content B"))
      expect(a.hash).not.toBe(b.hash)
    })
  })

  describe("get", () => {
    it("should retrieve stored data by hash", async () => {
      const original = Buffer.from("test data")
      const { hash } = await storage.put(original)

      const retrieved = await storage.get(hash)
      expect(retrieved).not.toBeNull()
      expect(retrieved!.toString()).toBe("test data")
    })

    it("should return null for non-existent hash", async () => {
      const result = await storage.get("0".repeat(64))
      expect(result).toBeNull()
    })
  })

  describe("exists", () => {
    it("should return true for stored file", async () => {
      const { hash } = await storage.put(Buffer.from("exists"))
      expect(await storage.exists(hash)).toBe(true)
    })

    it("should return false for non-existent file", async () => {
      expect(await storage.exists("0".repeat(64))).toBe(false)
    })
  })

  describe("remove", () => {
    it("should delete stored file", async () => {
      const { hash } = await storage.put(Buffer.from("to delete"))
      expect(await storage.exists(hash)).toBe(true)

      const removed = await storage.remove(hash)
      expect(removed).toBe(true)
      expect(await storage.exists(hash)).toBe(false)
    })

    it("should return false when removing non-existent file", async () => {
      const removed = await storage.remove("0".repeat(64))
      expect(removed).toBe(false)
    })
  })

  describe("directory structure", () => {
    it("should create nested directories based on hash prefix", async () => {
      const { hash, path } = await storage.put(Buffer.from("nested"))
      const prefix = hash.slice(0, 2)
      const suffix = hash.slice(2, 4)

      expect(path).toBe(join(tempDir, prefix, suffix, hash))
    })
  })

  describe("edge cases", () => {
    it("should handle empty buffer", async () => {
      const { hash, size } = await storage.put(Buffer.from(""))
      expect(size).toBe(0)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)

      const retrieved = await storage.get(hash)
      expect(retrieved).not.toBeNull()
      expect(retrieved!.length).toBe(0)
    })

    it("should be idempotent for same content", async () => {
      const a = await storage.put(Buffer.from("same"))
      const b = await storage.put(Buffer.from("same"))

      expect(a.hash).toBe(b.hash)
      expect(a.path).toBe(b.path)

      const content = await storage.get(a.hash)
      expect(content!.toString()).toBe("same")
    })

    it("should overwrite file with same hash", async () => {
      const data = Buffer.from("overwrite me")
      const first = await storage.put(data)
      const second = await storage.put(data)

      expect(first.hash).toBe(second.hash)

      const content = await storage.get(first.hash)
      expect(content).not.toBeNull()
      expect(content!.toString()).toBe("overwrite me")
    })
  })
})
