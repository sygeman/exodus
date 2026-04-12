import type { RPCSchema } from "electrobun";

export type EventoEnvironment = "bun" | "webview";
export type EventoMeta = { environment: EventoEnvironment };
export type EventoRPCEmit = { name: string; payload: unknown; meta: EventoMeta };

// Extended handler with segments
export type EventoHandlerContext = {
  name: string;
  payload: unknown;
  meta: EventoMeta;
  segments: string[];
};

export type EventoHandler = (context: EventoHandlerContext) => void;

export type EventoUnsubscribe = () => void;

export type RPCType = {
  bun: RPCSchema<{ messages: { emit: EventoRPCEmit } }>;
  webview: RPCSchema<{ messages: { emit: EventoRPCEmit } }>;
};