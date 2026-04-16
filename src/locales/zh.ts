import { loggerEvents } from "@/modules/logger/i18n/zh"
import { appStateEvents } from "@/modules/app-state/i18n/zh"
import { updaterEvents } from "@/modules/updater/i18n/zh"
import { schemaEvents } from "@/modules/schema/i18n/zh"

export default {
  common: {
    darkMode: "深色模式",
    lightMode: "浅色模式",
    back: "返回",
    close: "关闭",
    search: "搜索",
    details: "详情",
    debug: "调试",
    update: "更新",
    check: "检查",
    install: "安装",
    updateAvailable: "有可用更新",
    upToDate: "已是最新",
    updateError: "错误",
    checking: "检查中...",
    downloading: "下载中...",
    applying: "安装中...",
    updateAvailableTitle: "有可用更新",
    updateAvailableDescription: "{current} → {latest}",
    updateNow: "立即更新",
    updateLater: "稍后",
  },
  events: {
    title: "事件",
    logger: loggerEvents,
    "app-state": appStateEvents,
    updater: updaterEvents,
    schema: schemaEvents,
  },
  notFound: {
    title: "页面未找到",
    description: "您查找的页面不存在。",
    backHome: "返回项目列表",
  },
}
