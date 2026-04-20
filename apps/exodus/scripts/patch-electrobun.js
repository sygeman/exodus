import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"

// ============================================================================
// Patch 1: Fix drag region behavior in compiled preload script
// ============================================================================

const preloadFiles = [
  "node_modules/electrobun/dist-macos-arm64/api/bun/preload/.generated/compiled.ts",
  "node_modules/electrobun/dist/api/bun/preload/.generated/compiled.ts",
]

// Old code: v1 patch (document mouseup, no contextmenu disable)
const oldCodeV1 = `function initDragRegions() {\\n  let isDragging = false;\\n  document.addEventListener(\\"mousedown\\", (e) => {\\n    if (e.button !== 0) return;\\n    if (isAppRegionDrag(e)) {\\n      isDragging = true;\\n      send(\\"startWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n  document.addEventListener(\\"mouseup\\", (e) => {\\n    if (e.button !== 0) return;\\n    if (isDragging) {\\n      isDragging = false;\\n      send(\\"stopWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n}`

// Old code: v2 patch (window mouseup + blur, no contextmenu disable)
const oldCodeV2 = `function initDragRegions() {\\n  let isDragging = false;\\n  document.addEventListener(\\"mousedown\\", (e) => {\\n    if (e.button !== 0 || isDragging) return;\\n    if (isAppRegionDrag(e)) {\\n      isDragging = true;\\n      send(\\"startWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n  window.addEventListener(\\"mouseup\\", (e) => {\\n    if (e.button !== 0) return;\\n    if (isDragging) {\\n      isDragging = false;\\n      send(\\"stopWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n  window.addEventListener(\\"blur\\", () => {\\n    if (isDragging) {\\n      isDragging = false;\\n      send(\\"stopWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n}`

// Old code: v3/v4 patch (with timeout, will be cleaned up to v5)
const oldCodeV3V4 = `function initDragRegions() {\\n  let isDragging = false;\\n  let dragTimeout = null;\\n  window.addEventListener(\\"contextmenu\\", (e) => e.preventDefault());\\n  document.addEventListener(\\"mousedown\\", (e) => {\\n    if (e.button !== 0 || isDragging) return;\\n    if (isAppRegionDrag(e)) {\\n      isDragging = true;\\n      send(\\"startWindowMove\\", { id: window.__electrobunWindowId });\\n      dragTimeout = setTimeout(() => {\\n        if (isDragging) {\\n          isDragging = false;\\n          send(\\"stopWindowMove\\", { id: window.__electrobunWindowId });\\n        }\\n      }, 5000);\\n    }\\n  });\\n  window.addEventListener(\\"mouseup\\", (e) => {\\n    if (e.button !== 0) return;\\n    if (isDragging) {\\n      isDragging = false;\\n      clearTimeout(dragTimeout);\\n      send(\\"stopWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n  window.addEventListener(\\"blur\\", () => {\\n    if (isDragging) {\\n      isDragging = false;\\n      clearTimeout(dragTimeout);\\n      send(\\"stopWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n}`

// Original unpatched code
const oldCodeOriginal = `function initDragRegions() {\\n  document.addEventListener(\\"mousedown\\", (e) => {\\n    if (isAppRegionDrag(e)) {\\n      send(\\"startWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n  document.addEventListener(\\"mouseup\\", (e) => {\\n    if (isAppRegionDrag(e)) {\\n      send(\\"stopWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n}`

// New code: v5 patch — clean, no timeout
const newCode = `function initDragRegions() {\\n  let isDragging = false;\\n  window.addEventListener(\\"contextmenu\\", (e) => e.preventDefault());\\n  document.addEventListener(\\"mousedown\\", (e) => {\\n    if (e.button !== 0 || isDragging) return;\\n    if (isAppRegionDrag(e)) {\\n      isDragging = true;\\n      send(\\"startWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n  window.addEventListener(\\"mouseup\\", (e) => {\\n    if (e.button !== 0) return;\\n    if (isDragging) {\\n      isDragging = false;\\n      send(\\"stopWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n  window.addEventListener(\\"blur\\", () => {\\n    if (isDragging) {\\n      isDragging = false;\\n      send(\\"stopWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n}`

let patched = 0
let skipped = 0

for (const file of preloadFiles) {
  const path = join(process.cwd(), file)

  if (!existsSync(path)) {
    console.log(`[patch-electrobun] Skipped (not found): ${file}`)
    skipped++
    continue
  }

  try {
    const content = readFileSync(path, "utf-8")
    // Check if v5 is already applied
    if (
      content.includes('window.addEventListener(\\"contextmenu\\"') &&
      !content.includes("dragTimeout = setTimeout")
    ) {
      console.log(`[patch-electrobun] Already patched (v5): ${file}`)
      patched++
      continue
    }
    // Upgrade from v3/v4 to v5 (remove timeout)
    if (content.includes("dragTimeout = setTimeout")) {
      writeFileSync(path, content.replace(oldCodeV3V4, newCode))
      console.log(`[patch-electrobun] Upgraded v3/v4 → v5: ${file}`)
      patched++
      continue
    }
    // Upgrade from v2 to v5
    if (
      content.includes('window.addEventListener(\\"mouseup\\"') &&
      !content.includes('window.addEventListener(\\"contextmenu\\"')
    ) {
      writeFileSync(path, content.replace(oldCodeV2, newCode))
      console.log(`[patch-electrobun] Upgraded v2 → v5: ${file}`)
      patched++
      continue
    }
    // Upgrade from v1 to v5
    if (content.includes(oldCodeV1)) {
      writeFileSync(path, content.replace(oldCodeV1, newCode))
      console.log(`[patch-electrobun] Upgraded v1 → v5: ${file}`)
      patched++
      continue
    }
    // Patch original unpatched code
    if (content.includes(oldCodeOriginal)) {
      writeFileSync(path, content.replace(oldCodeOriginal, newCode))
      console.log(`[patch-electrobun] Patched: ${file}`)
      patched++
    } else {
      console.log(`[patch-electrobun] No patch needed (code not found): ${file}`)
      skipped++
    }
  } catch (err) {
    console.error(`[patch-electrobun] Failed to patch ${file}:`, err)
  }
}

// ============================================================================
// Patch 2: Fix WebKitGTK + NVIDIA + Wayland blank rendering
// ============================================================================
//
// Problem:
//   On Linux Wayland sessions with NVIDIA GPUs, WebKitGTK's DMA-BUF renderer
//   fails to create GBM buffers, resulting in a completely blank webview.
//   The env var WEBKIT_DISABLE_DMABUF_RENDERER=1 forces the fallback to the
//   shared-memory renderer which works correctly.
//
//   Setting it in src/bun/index.ts is too late: the launcher starts the GTK
//   event loop (startEventLoop) BEFORE the Bun Worker runs our app code.
//   The env must be set in the launcher (main.js) before startEventLoop.
//
// See: https://bugs.webkit.org/show_bug.cgi?id=261874

const launcherFiles = [
  "node_modules/electrobun/dist-macos-arm64/main.js",
  "node_modules/electrobun/dist/main.js",
]

// The existing linux block in main.js ends with the CEF/LD_PRELOAD check.
// We insert the Wayland workaround right after that block but still inside
// the `if (process.platform === "linux")`.
const launcherOldCode = `      child.on("exit", (code) => process.exit(code ?? 1));\n      return;\n    }\n  }`

const launcherNewCode = `      child.on("exit", (code) => process.exit(code ?? 1));\n      return;\n    }\n    const wayland = process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === "wayland";\n    if (wayland && process.env.WEBKIT_DISABLE_DMABUF_RENDERER !== "1") {\n      process.env.WEBKIT_DISABLE_DMABUF_RENDERER = "1";\n      console.log("[LAUNCHER] Wayland detected: WEBKIT_DISABLE_DMABUF_RENDERER=1");\n    }\n  }`

for (const file of launcherFiles) {
  const path = join(process.cwd(), file)

  if (!existsSync(path)) {
    console.log(`[patch-electrobun] Skipped (not found): ${file}`)
    skipped++
    continue
  }

  try {
    const content = readFileSync(path, "utf-8")

    // Already patched?
    if (content.includes("WEBKIT_DISABLE_DMABUF_RENDERER")) {
      console.log(`[patch-electrobun] Already patched (wayland): ${file}`)
      patched++
      continue
    }

    if (content.includes(launcherOldCode)) {
      writeFileSync(path, content.replace(launcherOldCode, launcherNewCode))
      console.log(`[patch-electrobun] Patched wayland workaround: ${file}`)
      patched++
    } else {
      console.log(`[patch-electrobun] No patch needed (code not found): ${file}`)
      skipped++
    }
  } catch (err) {
    console.error(`[patch-electrobun] Failed to patch ${file}:`, err)
  }
}

if (patched + skipped === preloadFiles.length + launcherFiles.length) {
  console.log("[patch-electrobun] Done")
  process.exit(0)
} else {
  console.error(
    `[patch-electrobun] Only ${patched + skipped}/${preloadFiles.length + launcherFiles.length} files handled`,
  )
  process.exit(1)
}
