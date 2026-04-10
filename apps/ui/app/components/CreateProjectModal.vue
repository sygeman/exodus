<template>
  <UModal v-model:open="isOpen" :dismissible="!createProject.isPending.value" title="Create New Project" description="Clone from Git repository or create new one">
    <template #body>
      <UForm
        ref="form"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          label="Project Name"
          name="name"
          required
          class="w-full"
        >
          <UInput
            v-model="state.name"
            placeholder="my-awesome-project"
            icon="i-lucide-folder"
            :disabled="createProject.isPending.value"
            autofocus
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Git Repository URL"
          name="gitUrl"
          help="Optional: Clone from an existing repository"
          class="w-full"
        >
          <UInput
            v-model="state.gitUrl"
            placeholder="https://github.com/user/repo.git"
            icon="i-lucide-git-branch"
            :disabled="createProject.isPending.value"
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end gap-3 pt-4">
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            :disabled="createProject.isPending.value"
            @click="isOpen = false"
          >
            Cancel
          </UButton>
          <UButton
            type="submit"
            color="primary"
            :loading="createProject.isPending.value"
          >
            Create Project
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'created': []
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const { createProject } = useProjects()

// Схема валидации согласно Nuxt UI v4
const schema = z.object({
  name: z.string().min(1, 'Project name is required'),
  gitUrl: z.union([
    z.string().url('Invalid URL format'),
    z.literal(''),
  ]).optional(),
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  name: '',
  gitUrl: '',
})

const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  createProject.mutate({
    name: event.data.name,
    gitUrl: event.data.gitUrl || undefined,
    initEmpty: true,
  }, {
    onSuccess: () => {
      emit('created')
      isOpen.value = false
      state.name = ''
      state.gitUrl = ''
    },
  })
}
</script>
