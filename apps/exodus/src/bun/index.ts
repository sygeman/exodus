import { BrowserView, BrowserWindow, Updater } from "electrobun/bun";
import { MyWebviewRPCType } from "../shared/types";
import { Evento } from "../shared/evento";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log("Vite dev server not running. Run 'bun run dev:hmr' for HMR support.");
    }
  }
  return "views://mainview/index.html";
}

// Create the main application window
const url = await getMainViewUrl();

const evento = new Evento();

evento.any((name, payload) => {
  console.log("Log to bun: ", name, payload);
});

const { webview } = new BrowserWindow({
  title: "Exodus",
  url,
  // titleBarStyle: "hiddenInset",
  frame: {
    width: 1200,
    height: 800,
    x: 0,
    y: 0,
  },
  rpc: BrowserView.defineRPC<MyWebviewRPCType>({
    maxRequestTime: 5000,
    handlers: {
      messages: {
        emit: ({ name, payload }) => {
          evento.emit(name, payload);
        },
      },
    },
  }),
});

const emit = (name: string, payload: unknown) => {
  if (!webview.rpc) {
    console.error("RPC not configured");
    return;
  }

  webview.rpc.send.emit({ name, payload });
};

// Ждём загрузки webview
webview.on("dom-ready", async () => {
  console.log("Vue app started!");

  evento.any((name, payload) => {
    emit(name, payload);
  });

  emit("broadcase", "yo from bun");
});
