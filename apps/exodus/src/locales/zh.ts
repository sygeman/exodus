import { loggerEvents } from "@/modules/logger/i18n/zh"
import { appStateEvents } from "@/modules/app-state/i18n/zh"
import { updaterEvents } from "@/modules/updater/i18n/zh"
import { schemaEvents } from "@/modules/schema/i18n/zh"

export default {
  common: {
    debug: "调试",
    settings: "设置",
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
