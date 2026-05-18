import { createRouter, createWebHashHistory } from "vue-router"

import ProjectsListPage from "@/components/ProjectsListPage.vue"
import ProjectPage from "@/components/ProjectPage.vue"
import ProjectIdeasPage from "@/components/ProjectIdeasPage.vue"
import IdeaPage from "@/components/IdeaPage.vue"
import ProjectFlowsPage from "@/components/ProjectFlowsPage.vue"
import FlowEditorPage from "@/components/FlowEditorPage.vue"
import FlowCodePage from "@/components/FlowCodePage.vue"
import FlowSettingsPage from "@/components/FlowSettingsPage.vue"
import ProjectSettingsPage from "@/components/ProjectSettingsPage.vue"
import DebugLogs from "@/components/DebugLogs.vue"
import DebugFlows from "@/components/DebugFlows.vue"
import DebugFlowRuns from "@/components/DebugFlowRuns.vue"
import SettingsAppearance from "@/components/SettingsAppearance.vue"
import SettingsLanguage from "@/components/SettingsLanguage.vue"
import NotFound from "@/components/NotFound.vue"

const routes = [
  { path: "/", redirect: "/projects" },
  { path: "/projects", name: "projects-list-page", component: ProjectsListPage },
  {
    path: "/project/:id",
    redirect: "/project/:id/overview",
    children: [
      { path: "/overview", name: "project-page", component: ProjectPage },
      { path: "/ideas", name: "project-ideas-page", component: ProjectIdeasPage },
      { path: "/ideas/:ideaId", name: "idea-page", props: true, component: IdeaPage },
      { path: "/flows", name: "project-flows-page", component: ProjectFlowsPage },
      {
        path: "/flows/:flowId",
        redirect: "/project/:id/flows/:flowId/graph",
        children: [
          { path: "/graph", name: "flow-editor-page", component: FlowEditorPage },
          { path: "/code", name: "flow-code-page", component: FlowCodePage },
          { path: "/settings", name: "flow-settings-page", component: FlowSettingsPage },
        ],
      },
      { path: "/settings", name: "project-settings-page", component: ProjectSettingsPage },
    ],
  },
  {
    path: "/debug",
    redirect: "/debug/logs",
    children: [
      { path: "/logs", name: "debug-logs", component: DebugLogs },
      { path: "/flows", name: "debug-flows", component: DebugFlows },
      { path: "/flows/:flowId", name: "debug-flow-runs", props: true, component: DebugFlowRuns },
    ],
  },
  {
    path: "/settings",
    redirect: "/settings/appearance",
    children: [
      { path: "/appearance", name: "settings-appearance", component: SettingsAppearance },
      { path: "/language", name: "settings-language", component: SettingsLanguage },
    ],
  },
  { path: "/:pathMatch(.*)*", name: "not-found", props: true, component: NotFound },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
