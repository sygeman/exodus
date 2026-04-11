import { Electroview } from "electrobun/view";
import type { MyWebviewRPCType } from "../shared/types";

export const rpc = Electroview.defineRPC<MyWebviewRPCType>({
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
