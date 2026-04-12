import type { RPCSchema } from "electrobun";

export type MyWebviewRPCType = {
  // Функции которые выполняются в bun
  bun: RPCSchema<{
    messages: {
      emit: { name: string; payload: unknown };
    };
  }>;
  // Функции которые выполняются в browser (webview)
  webview: RPCSchema<{
    messages: {
      emit: { name: string; payload: unknown };
    };
  }>;
};
