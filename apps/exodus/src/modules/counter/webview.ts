import { ref } from "vue";
import { evento } from "../../mainview/evento";

export function useCounter() {
  const count = ref(0);

  evento.on("counter:updated", ({ payload }) => {
    count.value = payload.count;
  });

  const increment = () => {
    evento.emitEvent("counter:increment", "user:click_btn_increment");
  };

  const reset = () => {
    evento.emitEvent("counter:reset", "user:click_btn_reset");
  };

  return { count, increment, reset };
}
