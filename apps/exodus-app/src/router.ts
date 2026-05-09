import { createRouter, createWebHashHistory } from "vue-router"

import ProjectsListPage from "@/components/ProjectsListPage.vue"
import ProjectPage from "@/components/ProjectPage.vue"
import ProjectIdeasPage from "@/components/ProjectIdeasPage.vue"
import IdeaPage from "@/components/IdeaPage.vue"
import ProjectSettingsPage from "@/components/ProjectSettingsPage.vue"
import DebugLogs from "@/components/DebugLogs.vue"
import DebugState from "@/components/DebugState.vue"
import SettingsAppearance from "@/components/SettingsAppearance.vue"
import SettingsLanguage from "@/components/SettingsLanguage.vue"
import NotFound from "@/components/NotFound.vue"

const routes = [
  { path: "/", redirect: "/projects" },
  { path: "/projects", name: "projects-list-page", component: ProjectsListPage },
  { path: "/project/:id/overview", name: "project-page", props: true, component: ProjectPage },
  {
    path: "/project/:id/ideas",
    name: "project-ideas-page",
    props: true,
    component: ProjectIdeasPage,
  },
  { path: "/project/:id/ideas/:ideaId", name: "idea-page", props: true, component: IdeaPage },
  {
    path: "/project/:id/settings",
    name: "project-settings-page",
    props: true,
    component: ProjectSettingsPage,
  },
  { path: "/debug/logs", name: "debug-logs", component: DebugLogs },
  { path: "/debug/state", name: "debug-state", component: DebugState },
  { path: "/settings/appearance", name: "settings-appearance", component: SettingsAppearance },
  { path: "/settings/language", name: "settings-language", component: SettingsLanguage },
  { path: "/:pathMatch(.*)*", name: "not-found", props: true, component: NotFound },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
