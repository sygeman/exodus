import { Electroview } from "electrobun/view";
import type { RPCType } from "./types";
import { Evento } from "./index";

export function createEventoWebview() {
  const evento = new Evento({ environment: "webview" });

  const rpc = Electroview.defineRPC<RPCType>({
    handlers: {
      messages: {
        // Emit from bun environment
        emit: ({ name, payload }) => {
          evento["_emitLocal"](name, payload, { environment: "bun" });
        },
      },
    },
  });

  return { evento, rpc };
}
