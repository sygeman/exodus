import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "./module"
import { resetDataEngine } from "./db"

const redPixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/l8J7LwAAAABJRU5ErkJggg==",
  "base64",
)

describe("data module files", () => {
  let tempDir: string
  let edem: ReturnType<typeof createEdem<[typeof dataModule]>>

  beforeEach(async () => {
    resetDataEngine()
    tempDir = await mkdtemp(join(tmpdir(), "edem-data-files-"))
    edem = createEdem([dataModule], { appData: tempDir })
  })

  afterEach(async () => {
    resetDataEngine()
    await rm(tempDir, { recursive: true, force: true })
  })

  async function writeSourceFile(name: string, data: string | Uint8Array): Promise<string> {
    const filePath = join(tempDir, name)
    await Bun.write(filePath, data)
    return filePath
  }

  function toBase64(data: Uint8Array): string {
    return Buffer.from(data).toString("base64")
  }

  function fromBase64(data: string): Buffer {
    return Buffer.from(data, "base64")
  }

  function hashBytes(data: Uint8Array): string {
    return createHash("sha256").update(data).digest("hex")
  }

  it("stores and deletes a regular file", async () => {
    const sourcePath = await writeSourceFile("source.txt", "hello file")

    const stored = await edem.data.storeFile({ file_path: sourcePath, name: "note.txt" })

    expect(stored.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(stored.size).toBe("hello file".length)
    expect(stored.path).toContain(stored.hash)

    const { file } = await edem.data.getFile({ hash: stored.hash })
    expect(file).not.toBeNull()
    if (!file) throw new Error("Expected stored file")

    expect(file.original_name).toBe("note.txt")
    expect(file.mime_type.startsWith("text/plain")).toBe(true)
    expect(file.ref_count).toBe(0)

    await expect(edem.data.fileExists({ hash: stored.hash })).resolves.toEqual({ exists: true })
    await expect(edem.data.getFilePath({ hash: stored.hash })).resolves.toEqual({
      path: stored.path,
    })

    const { url } = await edem.data.getFileStreamUrl({ hash: stored.hash })
    expect(url.startsWith("file://")).toBe(true)

    await expect(edem.data.deleteFile({ hash: stored.hash })).resolves.toEqual({ success: true })
    await expect(edem.data.fileExists({ hash: stored.hash })).resolves.toEqual({ exists: false })
  })

  it("deduplicates regular files by content hash", async () => {
    const firstPath = await writeSourceFile("first.txt", "same content")
    const secondPath = await writeSourceFile("second.txt", "same content")

    const first = await edem.data.storeFile({ file_path: firstPath })
    const second = await edem.data.storeFile({ file_path: secondPath })

    expect(second.hash).toBe(first.hash)
    expect(second.path).toBe(first.path)
  })

  it("uploads and reads file data in chunks", async () => {
    const data = Uint8Array.from({ length: 1537 }, (_, index) => index % 251)
    const expectedHash = hashBytes(data)
    const upload = await edem.data.beginFileUpload({
      name: "large.bin",
      mime_type: "application/octet-stream",
      size: data.byteLength,
    })

    expect(upload.upload_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(upload.chunk_size).toBeGreaterThan(0)

    for (let offset = 0; offset < data.byteLength; offset += 257) {
      const chunk = data.slice(offset, Math.min(offset + 257, data.byteLength))
      const result = await edem.data.writeFileUploadChunk({
        upload_id: upload.upload_id,
        offset,
        data_base64: toBase64(chunk),
      })

      expect(result.uploaded).toBe(offset + chunk.byteLength)
    }

    const completed = await edem.data.completeFileUpload({
      upload_id: upload.upload_id,
      expected_hash: expectedHash,
    })

    expect(completed.file.hash).toBe(expectedHash)
    expect(completed.file.original_name).toBe("large.bin")
    expect(completed.file.mime_type).toBe("application/octet-stream")
    expect(completed.file.size).toBe(data.byteLength)

    const chunks: Buffer[] = []
    for (let offset = 0; ;) {
      const chunk = await edem.data.readFileChunk({
        hash: expectedHash,
        offset,
        length: 300,
      })

      expect(chunk.offset).toBe(offset)
      expect(chunk.total).toBe(data.byteLength)
      expect(chunk.mime_type).toBe("application/octet-stream")
      expect(chunk.original_name).toBe("large.bin")

      chunks.push(fromBase64(chunk.data_base64))
      offset += chunk.length
      if (chunk.done) break
    }

    expect(Buffer.concat(chunks)).toEqual(Buffer.from(data))
  })

  it("aborts chunked file uploads", async () => {
    const upload = await edem.data.beginFileUpload({ name: "cancelled.txt", size: 3 })

    await edem.data.writeFileUploadChunk({
      upload_id: upload.upload_id,
      offset: 0,
      data_base64: toBase64(new TextEncoder().encode("abc")),
    })

    await expect(edem.data.abortFileUpload({ upload_id: upload.upload_id })).resolves.toEqual({
      success: true,
    })
    await expect(edem.data.completeFileUpload({ upload_id: upload.upload_id })).rejects.toThrow(
      "not found",
    )
  })

  it("attaches, updates, reorders and detaches item files", async () => {
    await edem.data.createCollection({
      id: "assets",
      name: "Assets",
      fields: [{ name: "attachment", type: "file" }],
    })
    const { collection } = await edem.data.getCollection({ collection_id: "assets" })
    const field = collection?.fields[0]
    if (!field) throw new Error("Expected file field")

    const { id: itemId } = await edem.data.createItem({
      collection_id: "assets",
      data: { attachment: "pending" },
    })
    const first = await edem.data.storeFile({
      file_path: await writeSourceFile("first.txt", "first"),
    })
    const second = await edem.data.storeFile({
      file_path: await writeSourceFile("second.txt", "second"),
    })

    const firstAttachment = await edem.data.attachFile({
      item_id: itemId,
      field_id: field.id,
      file_hash: first.hash,
      metadata: { caption: "first" },
    })
    const secondAttachment = await edem.data.attachFile({
      item_id: itemId,
      field_id: field.id,
      file_hash: second.hash,
    })

    await edem.data.updateItemFile({
      item_file_id: firstAttachment.id,
      metadata: { caption: "updated" },
    })
    await edem.data.reorderItemFiles({
      item_file_ids: [secondAttachment.id, firstAttachment.id],
    })

    const { files } = await edem.data.getItemFieldFiles({ item_id: itemId, field_id: field.id })
    expect(files.map((file) => file.id)).toEqual([secondAttachment.id, firstAttachment.id])
    expect(files[1].metadata).toEqual({ caption: "updated" })
    expect(files[1].file.ref_count).toBe(1)

    await expect(edem.data.detachFile({ item_file_id: firstAttachment.id })).resolves.toEqual({
      success: true,
    })

    const afterDetach = await edem.data.getItemFiles({ item_id: itemId })
    expect(afterDetach.files.map((file) => file.id)).toEqual([secondAttachment.id])

    const { file: detachedFile } = await edem.data.getFile({ hash: first.hash })
    expect(detachedFile?.ref_count).toBe(0)
  })

  it("extracts image metadata and generates webp thumbnails", async () => {
    const sourcePath = await writeSourceFile("pixel.png", redPixelPng)

    const stored = await edem.data.storeFile({ file_path: sourcePath })
    const { file } = await edem.data.getFile({ hash: stored.hash })
    expect(file).not.toBeNull()
    if (!file) throw new Error("Expected image file")

    expect(file.mime_type).toBe("image/png")
    expect(file.width).toBe(1)
    expect(file.height).toBe(1)
    expect(file.metadata?.format).toBe("png")

    const generated = await edem.data.generateThumbnails({
      file_hash: stored.hash,
      sizes: ["small", "medium"],
    })

    expect(generated.thumbnails).toHaveLength(2)
    expect(generated.thumbnails.map((thumbnail) => thumbnail.size_name)).toEqual([
      "small",
      "medium",
    ])

    for (const thumbnail of generated.thumbnails) {
      expect(thumbnail.format).toBe("webp")
      expect(thumbnail.width).toBe(1)
      expect(thumbnail.height).toBe(1)
      expect(await Bun.file(thumbnail.storage_path).exists()).toBe(true)
    }

    const { thumbnail } = await edem.data.getThumbnail({ file_hash: stored.hash, size: "small" })
    expect(thumbnail?.size_name).toBe("small")
    if (!thumbnail) throw new Error("Expected small thumbnail")

    const { thumbnails } = await edem.data.getFileThumbnails({ file_hash: stored.hash })
    expect(thumbnails).toHaveLength(2)

    const { path } = await edem.data.getThumbnailPath({ file_hash: stored.hash, size: "small" })
    expect(path).toBe(thumbnail.storage_path)

    const chunk = await edem.data.readThumbnailChunk({
      file_hash: stored.hash,
      size: "small",
      offset: 0,
      length: 8,
    })
    expect(chunk.mime_type).toBe("image/webp")
    expect(chunk.original_name).toBe(`${stored.hash}_small.webp`)
    expect(chunk.total).toBeGreaterThan(0)
    expect(fromBase64(chunk.data_base64).byteLength).toBe(chunk.length)
  })
})
