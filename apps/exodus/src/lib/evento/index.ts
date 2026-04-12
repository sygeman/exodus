import { EventoRPCEmit } from "./types";

type EventoEnvironment = "bun" | "webview";
type EventoMeta = { environment: EventoEnvironment };
type EventoHandler = (name: string, payload: unknown, meta: EventoMeta) => void;

type RPCSender = (data: EventoRPCEmit) => void;

export class Evento {
  private events: { [key: string]: EventoHandler[] } = {};
  private anys: EventoHandler[] = [];
  private sender?: RPCSender;
  private environment: EventoEnvironment = "bun";

  constructor({ environment }: { environment: EventoEnvironment }) {
    this.environment = environment;
  }

  on(name: string, handler: EventoHandler) {
    if (!this.events[name]) {
      this.events[name] = [];
    }
    this.events[name].push(handler);
  }

  any(handler: EventoHandler) {
    this.anys.push(handler);
  }

  emit(name: string, payload?: unknown) {
    this._emitLocal(name, payload, { environment: this.environment });
    this.sender?.({ name, payload });
  }

  private _emitLocal(name: string, payload: unknown, meta: EventoMeta) {
    this.events[name]?.forEach((handler) => handler(name, payload, meta));
    this.anys.forEach((handler) => handler(name, payload, meta));
    console.log("Evento", { name, payload, meta });
  }

  setSender(sender: RPCSender | undefined) {
    if (sender) {
      this.sender = sender;
    }
  }
}
