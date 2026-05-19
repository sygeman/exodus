<script setup lang="ts">
import { useRoute } from "vue-router"

const route = useRoute()
</script>

<template>
  <div class="flex flex-1 overflow-hidden">
    <div class="flex-1">
      <VueFlow
        :nodes="vfNodes"
        :edges="vfEdges"
        :default-viewport="{ zoom: 1, x: 0, y: 0 }"
        snap-to-grid
        :snap-grid="[16, 16]"
        fit-view-init
        class="flow-editor bg-default"
      />
    </div>
    <NodeConfigPanel />
  </div>
</template>
