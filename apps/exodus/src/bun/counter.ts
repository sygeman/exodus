import type { Evento } from "../lib/evento/evento";

export function initCounter(
  evento: Evento<"bun", ["webview"]>,
) {
  let count = 0;

  evento.on("counter:increment", () => {
    count++;
    evento.emit("counter:updated", { count });
  });

  evento.on("counter:reset", () => {
    count = 0;
    evento.emit("counter:updated", { count });
  });

  evento.emit("counter:updated", { count });
}
