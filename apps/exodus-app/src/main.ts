import "./app.css"
import ui from "@nuxt/ui/vue-plugin"
import { createApp } from "vue"
import App from "./App.vue"
import router from "./router"
import { rpc } from "./edem-bridge"
import { Electroview } from "electrobun/view"

void new Electroview({ rpc })

const app = createApp(App)
app.use(router)
app.use(ui)
app.mount("#app")
