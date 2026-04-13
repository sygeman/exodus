import { BrowserView } from "electrobun/bun";
import type { RPCSchema } from "electrobun";
import { Evento, type EventoMetaType } from "../lib/evento/evento";
import type { GlobalEventMap } from "../lib/evento/events";

export function createEventoBun() {
  const evento = new Evento<"bun", ["webview"], GlobalEventMap>("bun", "webview");

  type EventoMeta = EventoMetaType<typeof evento>;

  const rpc = BrowserView.defineRPC<{
    bun: RPCSchema<{ messages: { emit: { name: string; payload: unknown; meta: EventoMeta } } }>;
    webview: RPCSchema<{ messages: { emit: { name: string; payload: unknown; meta: EventoMeta } } }>;
  }>({
    handlers: {
      messages: {
        emit: ({ name, payload, meta }) => {
          evento.emitLocal(name, payload, meta);
        },
      },
    },
  });

  return { evento, rpc };
}
