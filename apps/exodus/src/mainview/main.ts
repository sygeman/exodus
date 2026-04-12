import "./app.css";
import ui from "@nuxt/ui/vue-plugin";
import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import { createEventoBunWebview } from "../lib/evento/webview-adapter";
import { Electroview } from "electrobun/view";

const { evento, rpc } = createEventoBunWebview();

const electroview = new Electroview({ rpc });
evento.setSender(electroview.rpc?.send);

const app = createApp(App);

const router = createRouter({
  routes: [],
  history: createWebHistory(),
});

app.use(router);
app.use(ui);

app.mount("#app");

evento.emit("test from webview");
