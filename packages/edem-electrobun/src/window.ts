import type { BrowserWindow } from "electrobun/bun"

interface WindowFrame {
  x: number
  y: number
  width: number
  height: number
}

export function onWindowFrameChange(
  win: BrowserWindow,
  callback: (data: { frame: WindowFrame; maximized?: boolean }) => void,
  options?: { debounce?: number },
) {
  const delay = options?.debounce ?? 300
  let timer: ReturnType<typeof setTimeout> | null = null

  function debounced(frame: WindowFrame) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => callback({ frame }), delay)
  }

  win.on("resize", (event: unknown) => {
    const e = event as { data?: WindowFrame }
    if (e.data) debounced(e.data)
  })

  win.on("move", () => {
    debounced(win.getFrame())
  })

  win.on("close", () => {
    if (timer) clearTimeout(timer)
    callback({ frame: win.getFrame(), maximized: win.isMaximized() })
  })
}
