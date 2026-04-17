import { projectsEvents } from "./events/zh"

export const projectsMessages = {
  common: {
    newProject: "新建项目",
    save: "保存",
    delete: "删除",
    cancel: "取消",
  },
  projects: {
    title: "项目",
    empty: "还没有项目",
    create: "创建项目",
    notFound: "项目未找到",
    backToList: "返回项目列表",
    settingsTitle: "项目设置",
    overview: "概览",
    general: "通用",
    emptyBoard: "看板为空",
    emptyBoardDescription: "项目内容将很快显示在这里。",
    name: "名称",
    nameDescription: "项目名称显示在列表和侧边栏中。",
    color: "颜色",
    colorDescription: "项目颜色用于在列表中进行视觉区分。",
    nameRequired: "名称必填",
    colorRequired: "颜色必填",
    deleteTitle: "删除项目",
    deleteDescription: "此操作无法撤销。所有项目数据将被永久删除。",
    deleteConfirmTitle: "删除项目？",
    deleteConfirmDescription: "您确定要删除此项目吗？此操作无法撤销。",
  },
  events: {
    projects: projectsEvents,
  },
}
