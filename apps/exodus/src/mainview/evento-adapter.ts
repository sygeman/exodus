import { Electroview } from "electrobun/view";
import type { RPCSchema } from "electrobun";
import { Evento, type EventoMetaType } from "../lib/evento/evento";
import type { GlobalEventMap } from "../lib/evento/events";

export function createEventoWebview() {
  const evento = new Evento<"webview", ["bun"], GlobalEventMap>("webview", "bun");

  type EventoMeta = EventoMetaType<typeof evento>;

  const rpc = Electroview.defineRPC<{
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
