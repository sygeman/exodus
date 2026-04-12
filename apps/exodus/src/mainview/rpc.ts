import { Electroview } from "electrobun/view";
import { MyWebviewRPCType } from "../shared/types";
import { Evento } from "../shared/evento";

export const evento = new Evento();

evento.any((name, payload) => {
  console.log("Log to browser: ", name, payload);
});

export const electroview = new Electroview({
  rpc: Electroview.defineRPC<MyWebviewRPCType>({
    handlers: {
      messages: {
        emit: ({ name, payload }) => {
          evento.emit(name, payload);
        },
      },
    },
  }),
});

export const emit = () => {
  if (!electroview.rpc) {
    throw new Error("RPC not configured");
  }

  // Отправить сообщение:
  electroview.rpc.send.emit({ name: "broadcast", payload: "hi from browser" });
};
