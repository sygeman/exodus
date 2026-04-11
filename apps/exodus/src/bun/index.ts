import { BrowserView, BrowserWindow, Updater } from "electrobun/bun";
import type { MyWebviewRPCType } from "../shared/types";

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
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
}

// Create the main application window
const url = await getMainViewUrl();

const myWebviewRPC = BrowserView.defineRPC<MyWebviewRPCType>({
	maxRequestTime: 5000,
	handlers: {
		requests: {
			someBunFunction: ({ a, b }) => {
				return a + b;
			},
		},
		messages: {
			logToBun: ({ msg }) => {
				console.log("Log to bun: ", msg);
			},
		},
	},
});

const { webview } = new BrowserWindow({
	title: "Exodus",
	url,
	frame: {
		width: 900,
		height: 700,
		x: 200,
		y: 200,
	},
	rpc: myWebviewRPC,
});

console.log("Vue app started!");

// Ждём загрузки webview
webview.on("dom-ready", async () => {
	console.log("Vue app started!");

	if (!webview.rpc) {
		console.error("RPC not configured");
		return;
	}

	// Теперь можно вызывать
	const answer = await webview.rpc.request.someWebviewFunction({ a: 4, b: 6 });
	console.log("answer:", answer);
	webview.rpc.send.logToWebview({ msg: "my message" });
});
