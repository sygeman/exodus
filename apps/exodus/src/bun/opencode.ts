const PORT = 4096
const BASE_URL = `http://127.0.0.1:${PORT}`

let serverProc: ReturnType<typeof Bun.spawn> | null = null

function cleanup() {
  if (serverProc) {
    serverProc.kill()
    serverProc = null
  }
}

process.on("exit", cleanup)
process.on("SIGINT", () => {
  cleanup()
  process.exit(0)
})
process.on("SIGTERM", () => {
  cleanup()
  process.exit(0)
})

async function isServerUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/session`, { method: "GET" })
    return res.ok || res.status === 400
  } catch {
    return false
  }
}

export async function startOpencodeServer() {
  if (await isServerUp()) {
    return
  }

  serverProc = Bun.spawn(["opencode", "serve", "--port", String(PORT), "--pure"], {
    stdout: "ignore",
    stderr: "pipe",
  })

  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    if (await isServerUp()) {
      return
    }
    await new Promise((r) => setTimeout(r, 500))
  }

  const stderr =
    serverProc.stderr instanceof ReadableStream
      ? await Bun.readableStreamToText(serverProc.stderr)
      : ""
  serverProc.kill()
  serverProc = null
  console.error("[opencode] failed to start:", stderr)
}
