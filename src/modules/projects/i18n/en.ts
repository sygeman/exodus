import { projectsEvents } from "./events/en"

export default {
  common: {
    newProject: "New Project",
    save: "Save",
    delete: "Delete",
    cancel: "Cancel",
  },
  projects: {
    title: "Projects",
    empty: "No projects yet",
    create: "Create project",
    notFound: "Project not found",
    backToList: "Back to projects",
    settingsTitle: "Project Settings",
    overview: "Overview",
    general: "General",
    emptyBoard: "Board is empty",
    emptyBoardDescription: "Project content will appear here soon.",
    name: "Name",
    nameDescription: "Project name is displayed in the list and sidebar.",
    color: "Color",
    colorDescription: "Project color is used for visual distinction in the list.",
    nameRequired: "Name is required",
    colorRequired: "Color is required",
    deleteTitle: "Delete project",
    deleteDescription:
      "This action cannot be undone. All project data will be permanently deleted.",
    openProject: "Open project",
    projectSettings: "Project settings",
    deleteConfirmTitle: "Delete project?",
    deleteConfirmDescription:
      "Are you sure you want to delete this project? This action cannot be undone.",
  },
  events: {
    projects: projectsEvents,
  },
}
