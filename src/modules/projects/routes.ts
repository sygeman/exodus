import type { RouteRecordRaw } from "vue-router"
import ProjectsListPage from "./pages/ProjectsListPage.vue"
import ProjectLayout from "./pages/ProjectLayout.vue"
import ProjectPage from "./pages/ProjectPage.vue"
import ProjectSettingsPage from "./pages/ProjectSettingsPage.vue"

export const projectsRoutes: RouteRecordRaw[] = [
  { path: "/projects", component: ProjectsListPage },
  {
    path: "/project/:id",
    component: ProjectLayout,
    redirect: (to) => `/project/${to.params.id}/board`,
    children: [
      { path: "board", component: ProjectPage },
      { path: "settings", component: ProjectSettingsPage },
    ],
  },
]
