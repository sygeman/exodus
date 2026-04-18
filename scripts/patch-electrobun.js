import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"

/**
 * Patches electrobun's compiled preload script to fix drag region behavior.
 *
 * Problem:
 *   Electrobun's dragRegions.ts listens to mousedown/mouseup on document and
 *   sends startWindowMove/stopWindowMove to the native layer without checking
 *   which mouse button was pressed. This causes issues:
 *
 *   1. Right-click (button=2) on a drag region triggers startWindowMove, which
 *      starts an NSLocalEventMonitor for mouse movement. The window then sticks
 *      to the cursor even though no button is held.
 *
 *   2. Native context menu intercepts mouse events and breaks window drag when
 *      left+right mouse buttons are pressed simultaneously.
 *
 * Fix:
 *   - Only react to left-click (button === 0).
 *   - Track isDragging state: stopWindowMove is only sent if startWindowMove
 *     was actually sent for this drag sequence.
 *   - Guard against re-entrant mousedown: ignore if already dragging.
 *   - Listen to mouseup on window (not document) to catch release outside.
 *   - Reset state on window blur to prevent stuck drag when focus is lost.
 *   - Disable native contextmenu to prevent event interception.
 *
 * Note: electrobun injects an inline compiled JS string (compiled.ts), not the
 * raw dragRegions.ts source, so we patch the compiled string directly.
 */

const files = [
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

for (const file of files) {
  const path = join(process.cwd(), file)

  if (!existsSync(path)) {
    console.log(`[patch-electrobun] Skipped (not found): ${file}`)
    skipped++
    continue
  }

  try {
    const content = readFileSync(path, "utf-8")
    // Check if v5 is already applied
    if (content.includes("window.addEventListener(\\\"contextmenu\\\"") && !content.includes("dragTimeout = setTimeout")) {
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
    if (content.includes("window.addEventListener(\\\"mouseup\\\"") && !content.includes("window.addEventListener(\\\"contextmenu\\\"")) {
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

if (patched + skipped === files.length) {
  console.log("[patch-electrobun] Done")
  process.exit(0)
} else {
  console.error(`[patch-electrobun] Only ${patched + skipped}/${files.length} files handled`)
  process.exit(1)
}
