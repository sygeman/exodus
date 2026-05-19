import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router"

import ProjectLayout from "@/components/ProjectLayout.vue"
import ProjectPage from "@/components/ProjectPage.vue"
import ProjectIdeasPage from "@/components/ProjectIdeasPage.vue"
import IdeaPage from "@/components/IdeaPage.vue"
import ProjectFlowsPage from "@/components/ProjectFlowsPage.vue"
import FlowEditorPage from "@/components/FlowEditorPage.vue"
import FlowEditorLayout from "@/components/FlowEditorLayout.vue"
import RuntimeScreenHost from "@/runtime/RuntimeScreenHost"
import FlowSettingsPage from "@/components/FlowSettingsPage.vue"
import ProjectSettingsPage from "@/components/ProjectSettingsPage.vue"
import DebugLayout from "@/components/DebugLayout.vue"
import DebugLogs from "@/components/DebugLogs.vue"
import DebugFlows from "@/components/DebugFlows.vue"
import DebugFlowRuns from "@/components/DebugFlowRuns.vue"
import SettingsLayoutPage from "@/components/SettingsLayoutPage.vue"
import SettingsAppearance from "@/components/SettingsAppearance.vue"
import SettingsLanguage from "@/components/SettingsLanguage.vue"
import NotFound from "@/components/NotFound.vue"

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/projects" },
  {
    path: "/projects",
    name: "projects-list",
    component: RuntimeScreenHost,
    meta: { screenId: "ProjectsListPage" },
  },
  {
    path: "/project/:id",
    redirect: `/project/:id/overview`,
    component: ProjectLayout,
    children: [
      { path: "overview", name: "project-overview", component: ProjectPage },
      { path: "ideas", name: "project-ideas", component: ProjectIdeasPage },
      { path: "ideas/:ideaId", name: "project-idea", props: true, component: IdeaPage },
      { path: "flows", name: "project-flows", component: ProjectFlowsPage },
      {
        path: "flows/:flowId",
        component: FlowEditorLayout,
        children: [
          {
            path: "",
            redirect: (to) => `/project/${to.params.id}/flows/${to.params.flowId}/graph`,
          },
          {
            path: "graph",
            name: "project-flow-graph",
            props: true,
            component: FlowEditorPage,
          },
          {
            path: "code",
            name: "project-flow-code",
            props: true,
            component: RuntimeScreenHost,
            meta: { screenId: "FlowCodePage" },
          },
          {
            path: "settings",
            name: "project-flow-settings",
            props: true,
            component: FlowSettingsPage,
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
      { path: "logs", name: "debug-logs", component: DebugLogs },
      { path: "flows", name: "debug-flows", component: DebugFlows },
      { path: "flows/:flowId", name: "debug-flow-runs", props: true, component: DebugFlowRuns },
    ],
  },
  {
    path: "/settings",
    redirect: "/settings/appearance",
    component: SettingsLayoutPage,
    children: [
      { path: "appearance", name: "settings-appearance", component: SettingsAppearance },
      { path: "language", name: "settings-language", component: SettingsLanguage },
    ],
  },
  { path: "/:pathMatch(.*)*", name: "not-found", component: NotFound },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
