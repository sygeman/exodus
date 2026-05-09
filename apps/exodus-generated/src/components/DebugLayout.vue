<script setup lang="ts"></script>

<template>
  <MenuLayout title="Debug" :items="navItems" main-class="overflow-hidden">
    <template #default>
      <RouterView />
    </template>
  </MenuLayout>
</template>
