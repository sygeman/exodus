<script setup lang="ts">

</script>

<template>
  <div class="flex h-full">
    <MenuLayout title="Settings" :items="navItems" main-class="overflow-y-auto p-10">
      <template #default>
        <div class="w-full">
          <h1 class="mb-8 text-2xl font-bold">{{ pageTitle }}</h1>
          <RouterView />
        </div>
      </template>
    </MenuLayout>
  </div>
</template>
