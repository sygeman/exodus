export type EventoMeta = { environment: string };

// Extended handler with segments
export type EventoHandlerContext<E extends string = string> = {
  name: string;
  payload: unknown;
  meta: { environment: E };
  segments: string[];
};

export type EventoHandler<E extends string = string> = (
  context: EventoHandlerContext<E>,
) => void;

export type EventoUnsubscribe = () => void;
