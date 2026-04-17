import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"

/**
 * Patches electrobun's compiled preload script to fix drag region behavior.
 *
 * Problem:
 *   Electrobun's dragRegions.ts listens to mousedown/mouseup on document and
 *   sends startWindowMove/stopWindowMove to the native layer without checking
 *   which mouse button was pressed. This causes two issues:
 *
 *   1. Right-click (button=2) on a drag region triggers startWindowMove, which
 *      starts an NSLocalEventMonitor for mouse movement. The window then sticks
 *      to the cursor even though no button is held.
 *
 *   2. When a context menu is dismissed with a left-click, the mouseup event
 *      (button=0) lands on the drag region and calls stopWindowMove. But if
 *      startWindowMove was never called (e.g., the mousedown was on the menu),
 *      the native isMovingWindow flag can get out of sync, leaving the window
 *      stuck to the cursor.
 *
 * Fix:
 *   - Only react to left-click (button === 0).
 *   - Track isDragging state: stopWindowMove is only sent if startWindowMove
 *     was actually sent for this drag sequence.
 *
 * Note: electrobun injects an inline compiled JS string (compiled.ts), not the
 * raw dragRegions.ts source, so we patch the compiled string directly.
 */

const files = [
  "node_modules/electrobun/dist-macos-arm64/api/bun/preload/.generated/compiled.ts",
  "node_modules/electrobun/dist/api/bun/preload/.generated/compiled.ts",
]

const oldCode = `function initDragRegions() {\\n  document.addEventListener(\\"mousedown\\", (e) => {\\n    if (isAppRegionDrag(e)) {\\n      send(\\"startWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n  document.addEventListener(\\"mouseup\\", (e) => {\\n    if (isAppRegionDrag(e)) {\\n      send(\\"stopWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n}`

const newCode = `function initDragRegions() {\\n  let isDragging = false;\\n  document.addEventListener(\\"mousedown\\", (e) => {\\n    if (e.button !== 0) return;\\n    if (isAppRegionDrag(e)) {\\n      isDragging = true;\\n      send(\\"startWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n  document.addEventListener(\\"mouseup\\", (e) => {\\n    if (e.button !== 0) return;\\n    if (isDragging) {\\n      isDragging = false;\\n      send(\\"stopWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n}`

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
    if (content.includes("let isDragging = false;")) {
      console.log(`[patch-electrobun] Already patched: ${file}`)
      patched++
      continue
    }
    if (content.includes(oldCode)) {
      writeFileSync(path, content.replace(oldCode, newCode))
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
