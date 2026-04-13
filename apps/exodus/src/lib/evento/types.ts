export type EventoMeta = { environment: string };

// Extended handler with segments
export type EventoHandlerContext<
  E extends string = string,
  P = unknown,
> = {
  name: string;
  payload: P;
  meta: { environment: E };
  segments: string[];
};

export type EventoHandler<E extends string = string, P = unknown> = (
  context: EventoHandlerContext<E, P>,
) => void;

export type EventoUnsubscribe = () => void;
