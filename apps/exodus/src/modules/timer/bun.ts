import type { EventoBun } from "../../bun/evento";

export function initTimer(evento: EventoBun) {
  setInterval(() => {
    evento.emitEvent("timer:tick", { time: Date.now() }, "system:timer_001");
  }, 10);
}
