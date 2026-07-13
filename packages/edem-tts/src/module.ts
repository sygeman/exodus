import { createEdemModule } from "@exodus/edem-core"
import { z } from "zod"
import { spawn } from "child_process"
import { join } from "path"
import { mkdir, access, writeFile, unlink } from "fs/promises"

const VOICE_BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main"

const AVAILABLE_VOICES = [
  { id: "ru_RU-irina-medium", name: "Ирина", lang: "ru", gender: "female", size: 63 },
  { id: "ru_RU-denis-medium", name: "Денис", lang: "ru", gender: "male", size: 63 },
  { id: "ru_RU-dmitri-medium", name: "Дмитрий", lang: "ru", gender: "male", size: 63 },
  { id: "ru_RU-ruslan-medium", name: "Руслан", lang: "ru", gender: "male", size: 63 },
]

const VoiceStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  lang: z.string(),
  gender: z.string(),
  size: z.number(),
  downloaded: z.boolean(),
})

function getVoiceUrl(voiceId: string): string {
  const parts = voiceId.split("-")
  const locale = parts[0]
  const lang = locale.split("_")[0]
  const name = parts[1]
  const quality = parts[2]
  return `${VOICE_BASE_URL}/${lang}/${locale}/${name}/${quality}/${voiceId}`
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed ${response.status}: ${url}`)
  const buf = Buffer.from(await response.arrayBuffer())
  await writeFile(dest, buf)
}

async function commandExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("which", [cmd])
    proc.on("close", (code) => resolve(code === 0))
    proc.on("error", () => resolve(false))
  })
}

async function installPiper(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn("pip", ["install", "--system", "piper-tts"], {
      stdio: ["pipe", "pipe", "pipe"],
    })
    let stderr = ""
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d
    })
    proc.on("close", (code: number) => {
      if (code === 0) resolve()
      else reject(new Error(`pip install failed: ${stderr}`))
    })
    proc.on("error", reject)
  })
}

export const ttsModule = createEdemModule("tts", (module) =>
  module
    .context(async (config) => {
      const voicesDir = config.appData
        ? join(config.appData, "piper", "voices")
        : join("/tmp", "piper", "voices")
      await mkdir(voicesDir, { recursive: true })
      return { voicesDir }
    })

    .query("listVoices", {
      input: z.object({}),
      output: z.object({ voices: z.array(VoiceStatusSchema) }),
      resolve: async ({ ctx }) => {
        const voices = []
        for (const voice of AVAILABLE_VOICES) {
          const modelPath = join(ctx.voicesDir, `${voice.id}.onnx`)
          const downloaded = await fileExists(modelPath)
          voices.push({ ...voice, downloaded })
        }
        return { voices }
      },
    })

    .mutation("downloadVoice", {
      input: z.object({ voice_id: z.string() }),
      output: z.object({ success: z.boolean() }),
      resolve: async ({ input, ctx }) => {
        const voice = AVAILABLE_VOICES.find((v) => v.id === input.voice_id)
        if (!voice) throw new Error(`Unknown voice: ${input.voice_id}`)

        const baseUrl = getVoiceUrl(input.voice_id)
        const modelPath = join(ctx.voicesDir, `${input.voice_id}.onnx`)
        const configPath = join(ctx.voicesDir, `${input.voice_id}.onnx.json`)

        await downloadFile(`${baseUrl}.onnx`, modelPath)
        await downloadFile(`${baseUrl}.onnx.json`, configPath)
        return { success: true }
      },
    })

    .mutation("deleteVoice", {
      input: z.object({ voice_id: z.string() }),
      output: z.object({ success: z.boolean() }),
      resolve: async ({ input, ctx }) => {
        const modelPath = join(ctx.voicesDir, `${input.voice_id}.onnx`)
        const configPath = join(ctx.voicesDir, `${input.voice_id}.onnx.json`)

        await unlink(modelPath).catch(() => {})
        await unlink(configPath).catch(() => {})
        return { success: true }
      },
    })

    .mutation("synthesize", {
      input: z.object({
        text: z.string(),
        voice_id: z.string().default("ru_RU-irina-medium"),
        speed: z.number().optional(),
      }),
      output: z.object({ audio: z.string() }),
      resolve: async ({ input, ctx }) => {
        if (!(await commandExists("piper"))) {
          await installPiper()
        }

        const modelPath = join(ctx.voicesDir, `${input.voice_id}.onnx`)
        if (!(await fileExists(modelPath))) {
          throw new Error(`Voice not downloaded: ${input.voice_id}`)
        }

        const lengthScale = 1.0 / (input.speed ?? 1.0)

        const audio = await new Promise<string>((resolve, reject) => {
          const proc = spawn(
            "piper",
            ["-m", modelPath, "--output-raw", "--length-scale", String(lengthScale)],
            { stdio: ["pipe", "pipe", "pipe"] },
          )

          const chunks: Buffer[] = []
          proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk))
          proc.stderr.on("data", () => {})

          proc.on("close", (code: number) => {
            if (code === 0) resolve(Buffer.concat(chunks).toString("base64"))
            else reject(new Error(`piper exited ${code}`))
          })
          proc.on("error", reject)

          proc.stdin.write(input.text)
          proc.stdin.end()
        })

        return { audio }
      },
    }),
)

export default ttsModule
