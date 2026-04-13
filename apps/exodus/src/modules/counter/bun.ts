import type { EventoBun } from "../../bun/evento";

export function initCounter(evento: EventoBun) {
  let count = 0;

  evento.on("counter:increment", () => {
    count++;
    evento.emit("counter:updated", { count });
  });

  evento.on("counter:reset", () => {
    count = 0;
    evento.emit("counter:updated", { count });
  });

  evento.on("timer:tick", () => {
    count++;
    evento.emit("counter:updated", { count });
  });

  evento.emit("counter:updated", { count });

  evento.on("counter:updated", ({ payload: { count } }) => {
    if (count >= 100) {
      evento.emit("counter:reset");
    }
  });
}
