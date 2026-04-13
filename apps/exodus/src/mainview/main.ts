import "./app.css";
import ui from "@nuxt/ui/vue-plugin";
import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import { createEventoWebview } from "./evento-adapter";
import { Electroview } from "electrobun/view";

const { evento, rpc } = createEventoWebview();

const electroview = new Electroview({ rpc });
evento.sender = electroview.rpc?.send?.emit;

evento.on("**", ({ name, payload, meta }) => {
  if (meta.environment === "bun") {
    console.log("[bun → webview]", name, payload);
  }
});

const app = createApp(App);

const router = createRouter({
  routes: [],
  history: createWebHistory(),
});

app.use(router);
app.use(ui);

app.mount("#app");

evento.emit("test from webview");
