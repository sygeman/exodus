import type { RouteRecordRaw } from "vue-router"
import ProjectsListPage from "./pages/ProjectsListPage.vue"
import ProjectLayout from "./pages/ProjectLayout.vue"
import ProjectPage from "./pages/ProjectPage.vue"
import ProjectIdeasPage from "./pages/ProjectIdeasPage.vue"
import IdeaPage from "./pages/IdeaPage.vue"
import ProjectSettingsPage from "./pages/ProjectSettingsPage.vue"

export const projectsRoutes: RouteRecordRaw[] = [
  { path: "/projects", component: ProjectsListPage },
  {
    path: "/project/:id",
    component: ProjectLayout,
    redirect: (to) => `/project/${to.params.id}/overview`,
    children: [
      { path: "overview", component: ProjectPage },
      { path: "ideas", component: ProjectIdeasPage },
      { path: "ideas/:ideaId", component: IdeaPage },
      { path: "settings", component: ProjectSettingsPage },
    ],
  },
]
