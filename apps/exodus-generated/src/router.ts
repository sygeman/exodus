import { createRouter, createWebHashHistory } from "vue-router"

import ProjectsListPage from "@/components/ProjectsListPage.vue"
import ProjectLayout from "@/components/ProjectLayout.vue"
import ProjectPage from "@/components/ProjectPage.vue"
import ProjectIdeasPage from "@/components/ProjectIdeasPage.vue"
import IdeaPage from "@/components/IdeaPage.vue"
import ProjectSettingsPage from "@/components/ProjectSettingsPage.vue"
import DebugLayout from "@/components/DebugLayout.vue"
import DebugLogs from "@/components/DebugLogs.vue"
import DebugState from "@/components/DebugState.vue"
import SettingsLayout from "@/components/SettingsLayout.vue"
import SettingsAppearance from "@/components/SettingsAppearance.vue"
import SettingsLanguage from "@/components/SettingsLanguage.vue"
import NotFound from "@/components/NotFound.vue"

const routes = [
  { path: "/", redirect: "/projects" },
  { path: "/projects", name: "projects-list-page", component: ProjectsListPage },
  {
    path: "/project/:id",
    redirect: "/project/:id/overview",
    props: true,
    component: ProjectLayout,
    children: [
      { path: "overview", name: "project-page", component: ProjectPage },
      { path: "ideas", name: "project-ideas-page", component: ProjectIdeasPage },
      { path: "ideas/:ideaId", name: "idea-page", props: true, component: IdeaPage },
      { path: "settings", name: "project-settings-page", component: ProjectSettingsPage },
    ],
  },
  {
    path: "/debug",
    redirect: "/debug/logs",
    component: DebugLayout,
    children: [
      { path: "logs", name: "debug-logs", component: DebugLogs },
      { path: "state", name: "debug-state", component: DebugState },
    ],
  },
  {
    path: "/settings",
    redirect: "/settings/appearance",
    component: SettingsLayout,
    children: [
      { path: "appearance", name: "settings-appearance", component: SettingsAppearance },
      { path: "language", name: "settings-language", component: SettingsLanguage },
    ],
  },
  { path: "/:pathMatch(.*)*", name: "not-found", props: true, component: NotFound },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
