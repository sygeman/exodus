export type TimerEventMap = {
  "timer:tick": { time: number };
};

export const timerOutgoingEvents = ["timer:tick"] as const;
