import { BrowserView } from "electrobun/bun";
import type { RPCType } from "./types";
import { Evento } from "./index";

export function createEventoBun() {
  const evento = new Evento({ environment: "bun" });

  const rpc = BrowserView.defineRPC<RPCType>({
    handlers: {
      messages: {
        // Emit from webview environment
        emit: ({ name, payload }) => {
          evento["_emitLocal"](name, payload, { environment: "webview" });
        },
      },
    },
  });

  return { evento, rpc };
}
