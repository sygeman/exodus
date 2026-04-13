import { ref } from "vue";
import { evento } from "../../mainview/evento";

export function useCounter() {
  const count = ref(0);

  evento.on("counter:updated", ({ payload }) => {
    count.value = payload.count;
  });

  const increment = () => {
    evento.emit("counter:increment");
  };

  const reset = () => {
    evento.emit("counter:reset");
  };

  return { count, increment, reset };
}
