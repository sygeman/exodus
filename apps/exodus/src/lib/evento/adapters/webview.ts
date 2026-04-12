import { Electroview } from "electrobun/view";
import type { RPCType } from "../types";
import { Evento } from "../evento";

export function createEventoWebview() {
  const evento = new Evento({ environment: "webview" });

  const rpc = Electroview.defineRPC<RPCType>({
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
