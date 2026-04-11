import { BrowserView } from "electrobun";
import type { MyWebviewRPCType } from "../shared/types";

export const myWebviewRPC = BrowserView.defineRPC<MyWebviewRPCType>({
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
