<script setup lang="ts">
const route = useRoute();

// Загружаем проекты
const { projects, isLoading, refetch } = useProjects();

const tooltipContent = {
    align: "center" as const,
    side: "bottom" as const,
    sideOffset: 8,
};

// Состояние модалки создания проекта
const isCreateModalOpen = ref(false);

// Системная навигация (прибита к низу)
const systemNavItems = computed(() => [
    {
        icon: "i-lucide-settings",
        to: "/settings",
        active: route.path.startsWith("/settings"),
    },
]);

useHead({
    title: "Exodus",
    meta: [
        { name: "description", content: "Development Environment Management" },
    ],
});
</script>

<template>
    <UApp>
        <div class="flex h-screen">
            <!-- Левый сайдбар -->
            <aside
                class="flex flex-col items-center pb-2 w-16 pt-4 border-r border-[var(--ui-border)]"
            >
                <!-- Лого -->
                <NuxtLink
                    to="/"
                    class="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg font-bold text-sm bg-[var(--ui-bg-elevated)]"
                >
                    E
                </NuxtLink>

                <!-- Проекты (скроллятся) -->
                <div
                    class="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-1 mt-4"
                >
                    <UTooltip
                        v-for="project in projects"
                        :key="project.id"
                        :text="project.name"
                        :content="tooltipContent"
                    >
                        <NuxtLink
                            :to="`/projects/${project.id}`"
                            class="flex-shrink-0 relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors font-semibold"
                            :class="
                                route.params.id === project.id
                                    ? 'bg-[var(--ui-bg-elevated)] text-[var(--ui-text)]'
                                    : 'text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]'
                            "
                        >
                            {{ project.name.charAt(0).toUpperCase() }}
                        </NuxtLink>
                    </UTooltip>

                    <!-- Кнопка создания проекта -->
                    <UTooltip text="New Project" :content="tooltipContent">
                        <button
                            class="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
                            @click="isCreateModalOpen = true"
                        >
                            <UIcon name="i-lucide-plus" class="w-5 h-5" />
                        </button>
                    </UTooltip>
                </div>

                <!-- Системная навигация -->
                <div
                    class="flex-shrink-0 flex flex-col items-center gap-1 mt-2"
                >
                    <UTooltip
                        v-for="item in systemNavItems"
                        :key="item.to"
                        text="Settings"
                        :content="tooltipContent"
                    >
                        <NuxtLink
                            :to="item.to"
                            class="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
                            :class="
                                item.active
                                    ? 'bg-[var(--ui-bg-elevated)] text-[var(--ui-text)]'
                                    : 'text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]'
                            "
                        >
                            <UIcon :name="item.icon" class="w-5 h-5" />
                        </NuxtLink>
                    </UTooltip>
                </div>
            </aside>

            <!-- Основной контент -->
            <UMain class="flex-1 overflow-auto">
                <NuxtLayout>
                    <NuxtPage />
                </NuxtLayout>
            </UMain>
        </div>

        <!-- Глобальная модалка создания проекта -->
        <CreateProjectModal
            v-model:open="isCreateModalOpen"
            @created="refetch"
        />
    </UApp>
</template>
