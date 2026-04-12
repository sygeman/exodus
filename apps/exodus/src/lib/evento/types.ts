export type { Evento } from "./index";
import type { RPCSchema } from "electrobun";

export type RPCType = {
  bun: RPCSchema<{
    messages: {
      emit: { name: string; payload: unknown };
    };
  }>;
  webview: RPCSchema<{
    messages: {
      emit: { name: string; payload: unknown };
    };
  }>;
};
