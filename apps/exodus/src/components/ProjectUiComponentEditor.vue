<script setup lang="ts">
import { computed } from "vue"
import type { ComponentNode } from "@/project-manifest-schemas"
import { getProjectUiComponentTree, type ProjectUiComponentSourceItem } from "@/project-ui-source"
import ProjectUiPreviewNode from "@/components/ProjectUiPreviewNode.vue"

defineOptions({ name: "ProjectUiComponentEditor" })

defineEmits<{
  saveName: [name: string]
  saveTree: [tree: ComponentNode]
  delete: []
}>()

const props = defineProps<{
  componentItem: ProjectUiComponentSourceItem
}>()

const tree = computed(() => getProjectUiComponentTree(props.componentItem))
</script>

<template>
  <div class="bg-elevated/10 flex h-full min-h-0 flex-1 overflow-auto p-6">
    <div class="mx-auto flex w-full max-w-6xl items-start">
      <div class="border-default bg-default w-full overflow-hidden rounded-2xl border shadow-sm">
        <div class="min-h-[720px] w-full">
          <ProjectUiPreviewNode :node="tree" :is-root="true" />
        </div>
      </div>
    </div>
  </div>
</template>
