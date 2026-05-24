import { describe, expect, it } from "bun:test"
import {
  buildProjectUiComponentsManifest,
  buildProjectUiRoutesManifest,
  getProjectUiComponentManifestId,
  getProjectUiComponentTree,
  normalizeProjectUiRoute,
} from "./project-ui-source"

describe("project ui source", () => {
  it("uses manifest_id as component key", () => {
    expect(
      getProjectUiComponentManifestId({
        id: "local-component",
        data: {
          manifest_id: "ProjectsListPage",
          tree: { component: "div", children: [] },
        },
      }),
    ).toBe("ProjectsListPage")
  })

  it("falls back to a default tree when source tree is invalid", () => {
    expect(
      getProjectUiComponentTree({
        id: "local-component",
        data: {
          manifest_id: "ProjectsListPage",
          tree: { wrong: true },
        },
      }),
    ).toEqual({
      component: "div",
      children: [],
    })
  })

  it("builds components manifest from source items", () => {
    expect(
      buildProjectUiComponentsManifest([
        {
          id: "local-component",
          data: {
            manifest_id: "ProjectsListPage",
            tree: { component: "div", children: [] },
          },
        },
      ]),
    ).toEqual({
      ProjectsListPage: { component: "div", children: [] },
    })
  })

  it("normalizes flat route records", () => {
    expect(
      normalizeProjectUiRoute({
        id: "route-1",
        data: {
          manifest_id: "project-root",
          path: "/project/:id",
          sort_order: 10,
        },
      }),
    ).toEqual({
      id: "route-1",
      manifestId: "project-root",
      path: "/project/:id",
      root: undefined,
      redirect: undefined,
      parentManifestId: undefined,
      sortOrder: 10,
    })
  })

  it("builds nested routes manifest from flat source records", () => {
    expect(
      buildProjectUiRoutesManifest([
        {
          id: "route-1",
          data: {
            manifest_id: "project-root",
            path: "/project/:id",
            redirect: "/project/:id/overview",
          },
        },
        {
          id: "route-2",
          data: {
            manifest_id: "project-overview",
            path: "/overview",
            root: "ProjectPage",
            parent_manifest_id: "project-root",
          },
        },
      ]),
    ).toEqual({
      routes: [
        {
          path: "/project/:id",
          root: undefined,
          redirect: "/project/:id/overview",
          children: [
            { path: "/overview", root: "ProjectPage", redirect: undefined, children: undefined },
          ],
        },
      ],
      components: {},
    })
  })
})
