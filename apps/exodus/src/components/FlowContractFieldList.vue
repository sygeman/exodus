<script setup lang="ts">
import { computed } from "vue"
import type { TreeItem } from "@nuxt/ui"
import type { NodeContractField } from "@/flow-node-contract"

defineOptions({ name: "FlowContractFieldList" })

type ContractTreeItem = TreeItem & {
  id: string
  label: string
  field: NodeContractField
  defaultExpanded?: boolean
  children?: ContractTreeItem[]
}

const props = defineProps<{
  fields: NodeContractField[]
}>()

const items = computed<ContractTreeItem[]>(() =>
  props.fields.map((field, index) => toTreeItem(field, `field-${index}`)),
)

function toTreeItem(field: NodeContractField, id: string): ContractTreeItem {
  return {
    id,
    label: field.required === false ? `${field.name}?` : field.name,
    field,
    defaultExpanded: field.children.length > 0,
    children:
      field.children.length > 0
        ? field.children.map((child, index) => toTreeItem(child, `${id}-${index}`))
        : undefined,
  }
}

function preventSelection(event: { preventDefault: () => void }) {
  event.preventDefault()
}

function getItemKey(item: ContractTreeItem): string {
  return item.id
}
</script>

<template>
  <UTree
    :items="items"
    :get-key="getItemKey"
    :as="{ link: 'div' }"
    color="neutral"
    size="sm"
    :ui="{
      root: 'w-full',
      link: 'px-0 py-1.5 gap-2',
      linkLabel: 'w-full',
      listWithChildren: 'ms-3 border-s border-default/50',
      itemWithChildren: 'ps-0 -ms-px',
      linkTrailing: 'ms-2',
    }"
    @select="preventSelection"
  >
    <template #item="{ item }">
      <div class="flex min-w-0 flex-col gap-1">
        <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <span class="font-mono text-xs break-words">{{ item.label }}</span>
          <span class="text-muted font-mono text-xs break-words">{{ item.field.type }}</span>
        </div>

        <div v-if="item.field.enumValues.length > 0" class="flex flex-wrap gap-1">
          <UBadge
            v-for="enumValue in item.field.enumValues"
            :key="`${item.id}-${enumValue}`"
            color="neutral"
            variant="subtle"
            class="text-[10px]"
          >
            {{ enumValue }}
          </UBadge>
        </div>
      </div>
    </template>
  </UTree>
</template>
