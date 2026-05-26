import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router"

import ProjectsListPage from "@/components/ProjectsListPage.vue"
import ProjectLayout from "@/components/ProjectLayout.vue"
import ProjectOverviewPage from "@/components/ProjectOverviewPage.vue"
import ProjectIdeasPage from "@/components/ProjectIdeasPage.vue"
import ProjectIdeaPage from "@/components/ProjectIdeaPage.vue"
import ProjectDataPage from "@/components/ProjectDataPage.vue"
import ProjectFlowsPage from "@/components/ProjectFlowsPage.vue"
import ProjectFlowGraphPage from "@/components/ProjectFlowGraphPage.vue"
import ProjectFlowLayout from "@/components/ProjectFlowLayout.vue"
import ProjectFlowCodePage from "@/components/ProjectFlowCodePage.vue"
import ProjectFlowSettingsPage from "@/components/ProjectFlowSettingsPage.vue"
import ProjectUiPage from "@/components/ProjectUiPage.vue"
import ProjectSettingsPage from "@/components/ProjectSettingsPage.vue"
import DebugLayout from "@/components/DebugLayout.vue"
import DebugLogsPage from "@/components/DebugLogsPage.vue"
import DebugFlowsPage from "@/components/DebugFlowsPage.vue"
import DebugFlowRunsPage from "@/components/DebugFlowRunsPage.vue"
import SettingsPage from "@/components/SettingsPage.vue"
import SettingsAppearancePage from "@/components/SettingsAppearancePage.vue"
import SettingsLanguagePage from "@/components/SettingsLanguagePage.vue"
import NotFoundPage from "@/components/NotFoundPage.vue"

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/projects" },
  { path: "/projects", name: "projects-list", component: ProjectsListPage },
  {
    path: "/project/:id",
    redirect: `/project/:id/overview`,
    component: ProjectLayout,
    children: [
      { path: "overview", name: "project-overview", component: ProjectOverviewPage },
      { path: "ideas", name: "project-ideas", component: ProjectIdeasPage },
      { path: "ideas/:ideaId", name: "project-idea", props: true, component: ProjectIdeaPage },
      { path: "data", name: "project-data", component: ProjectDataPage },
      { path: "data/manifest", name: "project-data-manifest", component: ProjectDataPage },
      { path: "data/:collectionId", name: "project-data-collection", component: ProjectDataPage },
      {
        path: "data/:collectionId/:section",
        name: "project-data-section",
        component: ProjectDataPage,
      },
      { path: "ui", name: "project-ui", component: ProjectUiPage },
      { path: "flows", name: "project-flows", component: ProjectFlowsPage },
      {
        path: "flows/:flowId",
        component: ProjectFlowLayout,
        children: [
          {
            path: "",
            redirect: (to) => `/project/${to.params.id}/flows/${to.params.flowId}/graph`,
          },
          {
            path: "graph",
            name: "project-flow-graph",
            props: true,
            component: ProjectFlowGraphPage,
          },
          {
            path: "code",
            name: "project-flow-code",
            props: true,
            component: ProjectFlowCodePage,
          },
          {
            path: "settings",
            name: "project-flow-settings",
            props: true,
            component: ProjectFlowSettingsPage,
          },
        ],
      },
      { path: "settings", name: "project-settings", component: ProjectSettingsPage },
    ],
  },
  {
    path: "/debug",
    redirect: "/debug/logs",
    component: DebugLayout,
    children: [
      { path: "logs", name: "debug-logs", component: DebugLogsPage },
      { path: "flows", name: "debug-flows", component: DebugFlowsPage },
      {
        path: "flows/:flowId",
        name: "debug-flow-runs",
        props: true,
        component: DebugFlowRunsPage,
      },
    ],
  },
  {
    path: "/settings",
    redirect: "/settings/appearance",
    component: SettingsPage,
    children: [
      { path: "appearance", name: "settings-appearance", component: SettingsAppearancePage },
      { path: "language", name: "settings-language", component: SettingsLanguagePage },
    ],
  },
  { path: "/:pathMatch(.*)*", name: "not-found", component: NotFoundPage },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
