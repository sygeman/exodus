import "./app.css"
import ui from "@nuxt/ui/vue-plugin"
import { createApp } from "vue"
import { createRouter, createWebHistory } from "vue-router"
import App from "./App.vue"
import CounterPage from "./pages/CounterPage.vue"
import EventoModal from "./components/EventoModal.vue"
import { evento, rpc } from "./evento"
import { Electroview } from "electrobun/view"

const electroview = new Electroview({ rpc })
evento.sender = (msg: { name: string; payload: unknown; meta: any }) => {
  ;(electroview.rpc as any).send.emit(msg)
}

const app = createApp(App)

const router = createRouter({
  routes: [
    { path: "/", component: CounterPage },
  ],
  history: createWebHistory(),
})

app.use(router)
app.use(ui)

app.mount("#app")
