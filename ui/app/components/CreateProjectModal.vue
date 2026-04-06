<template>
  <UModal v-model:open="isOpen" :dismissible="!createProject.isPending.value" title="Create New Project" description="Create from Git repository or start with empty repository">
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
        >
          <UInput
            v-model="state.name"
            placeholder="my-awesome-project"
            icon="i-lucide-folder"
            :disabled="createProject.isPending.value"
            autofocus
          />
        </UFormField>

        <UFormField
          label="Git Repository URL"
          name="gitUrl"
          help="Optional: Clone from an existing repository"
        >
          <UInput
            v-model="state.gitUrl"
            placeholder="https://github.com/user/repo.git"
            icon="i-lucide-git-branch"
            :disabled="createProject.isPending.value"
          />
        </UFormField>

        <UFormField
          v-if="!state.gitUrl"
          name="initEmpty"
        >
          <UCheckbox
            v-model="state.initEmpty"
            label="Initialize empty Git repository"
            :disabled="createProject.isPending.value"
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

const schema = z.object({
  name: z.string().min(1, 'Project name is required').max(255, 'Name too long'),
  gitUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  initEmpty: z.boolean().default(false),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  name: '',
  gitUrl: '',
  initEmpty: false,
})

const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  createProject.mutate({
    name: event.data.name,
    gitUrl: event.data.gitUrl || undefined,
    initEmpty: event.data.initEmpty,
  }, {
    onSuccess: () => {
      emit('created')
      isOpen.value = false
      state.name = ''
      state.gitUrl = ''
      state.initEmpty = false
    },
  })
}
</script>
