// ── App Stage ─────────────────────────────────────────────────────────────────
// Generates .vue component files from IR component trees.

import type { Stage, StageInput, StageOutput, OutputFile, IR, IRComponent } from "../../ir"
import { renderNode } from "./template"
import { renderScript } from "./script"

export const appStage: Stage = {
  name: "app",

  async handle({ ir }: StageInput): Promise<StageOutput> {
    const files: OutputFile[] = []

    for (const comp of ir.components) {
      files.push({
        path: `src/components/${comp.name}.vue`,
        content: generateVueComponent(comp, ir),
      })
    }

    files.push({
      path: ".gitignore",
      content: `node_modules\ndist\n.DS_Store\n*.local\n`,
    })

    return { files, deps: [] }
  },
}

function generateVueComponent(comp: IRComponent, ir: IR): string {
  const { template, handlers } = renderNode(comp.tree, "  ", ir, comp.name)
  const script = renderScript(comp, ir, handlers)

  return `<script setup lang="ts">
${script}
</script>

<template>
${template}
</template>
`
}
