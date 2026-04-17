import { readFileSync, writeFileSync } from "fs"
import { join } from "path"

const files = [
  "node_modules/electrobun/dist-macos-arm64/api/bun/preload/.generated/compiled.ts",
  "node_modules/electrobun/dist/api/bun/preload/.generated/compiled.ts",
]

const oldCode = `function initDragRegions() {\\n  document.addEventListener(\\"mousedown\\", (e) => {\\n    if (isAppRegionDrag(e)) {\\n      send(\\"startWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n  document.addEventListener(\\"mouseup\\", (e) => {\\n    if (isAppRegionDrag(e)) {\\n      send(\\"stopWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n}`

const newCode = `function initDragRegions() {\\n  let isDragging = false;\\n  document.addEventListener(\\"mousedown\\", (e) => {\\n    if (e.button !== 0) return;\\n    if (isAppRegionDrag(e)) {\\n      isDragging = true;\\n      send(\\"startWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n  document.addEventListener(\\"mouseup\\", (e) => {\\n    if (e.button !== 0) return;\\n    if (isDragging) {\\n      isDragging = false;\\n      send(\\"stopWindowMove\\", { id: window.__electrobunWindowId });\\n    }\\n  });\\n}`

let patched = 0

for (const file of files) {
  const path = join(process.cwd(), file)
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
      console.error(`[patch-electrobun] Could not find expected code in: ${file}`)
    }
  } catch (err) {
    console.error(`[patch-electrobun] Failed to patch ${file}:`, err)
  }
}

if (patched === files.length) {
  console.log("[patch-electrobun] All files patched successfully")
  process.exit(0)
} else {
  console.error(`[patch-electrobun] Only ${patched}/${files.length} files patched`)
  process.exit(1)
}
