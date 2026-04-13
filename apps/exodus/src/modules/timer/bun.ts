import type { EventoBun } from "../../bun/evento";

export function initTimer(evento: EventoBun) {
  setInterval(() => {
    evento.emit("timer:tick", { time: Date.now() });
  }, 10);
}
