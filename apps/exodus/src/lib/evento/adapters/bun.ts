import { BrowserView } from "electrobun/bun";
import type { RPCType } from "../types";
import { Evento } from "../evento";

export function createEventoBun() {
  const evento = new Evento({ environment: "bun" });

  const rpc = BrowserView.defineRPC<RPCType>({
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
