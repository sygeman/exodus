<script setup lang="ts">
import type { ACSDNode } from '~/types/acsd'

const props = defineProps<{
  node: ACSDNode | null
  projectName: string
}>()

const emit = defineEmits<{
  action: [action: string, nodeId: string]
}>()
</script>

<template>
  <div class="acsd-node-panel h-full bg-neutral-900 border-l border-neutral-800 p-4 overflow-y-auto">
    <!-- Ничего не выбрано -->
    <div v-if="!node" class="text-center py-8">
      <UIcon name="i-lucide-git-branch" class="w-12 h-12 text-neutral-600 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-neutral-200 mb-2">{{ projectName }}</h3>
      <p class="text-sm text-neutral-500">Выберите ноду в графе</p>
    </div>

    <!-- Gap выбран -->
    <div v-else-if="node.status === 'gap'" class="space-y-4">
      <div class="flex items-center gap-2 text-amber-500">
        <UIcon name="i-lucide-help-circle" class="w-5 h-5" />
        <span class="font-medium">Gap {{ node.level }}</span>
      </div>
      
      <p class="text-sm text-neutral-400">
        Этот уровень каскада не заполнен
      </p>

      <UButton block color="primary" @click="emit('action', 'create', node.id)">
        Создать
      </UButton>
    </div>

    <!-- Нода выбрана -->
    <div v-else class="space-y-4">
      <div class="flex items-center justify-between">
        <UBadge :color="node.level === 'L0' ? 'amber' : 'neutral'" variant="soft">
          {{ node.level }}
        </UBadge>
        <UBadge color="neutral" variant="soft">
          {{ node.type }}
        </UBadge>
      </div>

      <div class="text-sm text-neutral-200 leading-relaxed">
        {{ node.text }}
      </div>

      <div class="pt-4 border-t border-neutral-800 space-y-2">
        <UButton 
          v-if="node.level !== 'L4'"
          block 
          color="primary" 
          variant="soft"
          @click="emit('action', 'detail', node.id)"
        >
          Детализировать
        </UButton>
        
        <UButton 
          block 
          color="neutral" 
          variant="ghost"
          @click="emit('action', 'trace', node.id)"
        >
          Трассировка
        </UButton>
        
        <UButton 
          block 
          color="neutral" 
          variant="ghost"
          @click="emit('action', 'edit', node.id)"
        >
          Изменить
        </UButton>
      </div>
    </div>
  </div>
</template>
