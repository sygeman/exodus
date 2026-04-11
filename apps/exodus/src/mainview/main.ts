import "./app.css";
import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");

import { Electroview } from "electrobun/view";
import type { MyWebviewRPCType } from "../shared/types";

const rpc = Electroview.defineRPC<MyWebviewRPCType>({
	handlers: {
		requests: {
			someWebviewFunction: ({ a, b }) => {
				return a + b;
			},
		},
		messages: {
			logToWebview: ({ msg }) => {
				console.log(`bun asked me to log: ${msg}`);
			},
		},
	},
});

const electroview = new Electroview({ rpc });

if (!electroview.rpc) {
	throw new Error("RPC not configured");
}

// Вызвать функцию bun из browser:
electroview.rpc.request.someBunFunction({ a: 9, b: 8 }).then((result) => {
	console.log("result: ", result);
});

// Отправить сообщение:
electroview.rpc.send.logToBun({ msg: "hi from browser" });
