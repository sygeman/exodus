export type { Evento } from "./index";
import type { RPCSchema } from "electrobun";

export type EventoRPCEmit = { name: string; payload: unknown };

export type RPCType = {
  bun: RPCSchema<{ messages: { emit: EventoRPCEmit } }>;
  webview: RPCSchema<{ messages: { emit: EventoRPCEmit } }>;
};
