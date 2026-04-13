import { ref } from "vue";
import { useEvento } from "./useEvento";

export function useCounter() {
  const evento = useEvento();
  const count = ref(0);

  evento.on("counter:updated", ({ payload }) => {
    if (
      typeof payload === "object" &&
      payload !== null &&
      "count" in payload
    ) {
      count.value = (payload as { count: number }).count;
    }
  });

  const increment = () => {
    evento.emit("counter:increment");
  };

  const reset = () => {
    evento.emit("counter:reset");
  };

  return { count, increment, reset };
}
