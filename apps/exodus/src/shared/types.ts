import type { RPCSchema } from "electrobun";

export type MyWebviewRPCType = {
	// Функции которые выполняются в bun
	bun: RPCSchema<{
		requests: {
			someBunFunction: {
				params: { a: number; b: number };
				response: number;
			};
		};
		messages: {
			logToBun: { msg: string };
		};
	}>;
	// Функции которые выполняются в browser (webview)
	webview: RPCSchema<{
		requests: {
			someWebviewFunction: {
				params: { a: number; b: number };
				response: number;
			};
		};
		messages: {
			logToWebview: { msg: string };
		};
	}>;
};
