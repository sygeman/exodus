import { Events, type EventsHandlerContext } from "./events"

export type Module = (edem: Edem) => void

export class Edem {
  private events: Events
  private currentContext: EventsHandlerContext | null = null

  constructor(environment: string) {
    this.events = new Events(environment)
  }

  register(module: Module): this {
    module(this)
    return this
  }

  // Event bus methods (internal use by modules)
  on(name: string, handler: (ctx: EventsHandlerContext) => void): () => void {
    return this.events.on(name, handler)
  }

  once(name: string, handler: (ctx: EventsHandlerContext) => void): () => void {
    return this.events.once(name, handler)
  }

  off(handler: (ctx: EventsHandlerContext) => void): void {
    this.events.off(handler)
  }

  emit(name: string, payload?: unknown, source?: string): void {
    this.events.emitEvent(name, payload, source)
  }

  request(name: string, payload?: unknown, options?: { timeout?: number }): Promise<unknown> {
    const traceId = this.currentContext?.meta?.trace_id
    return this.events.request(name, payload, { ...options, traceId })
  }

  handle(
    name: string,
    handler: (ctx: EventsHandlerContext) => unknown | Promise<unknown>,
  ): () => void {
    return this.events.handle(name, (ctx) => {
      const prevContext = this.currentContext
      this.currentContext = ctx
      try {
        const result = handler(ctx)
        return result
      } finally {
        this.currentContext = prevContext
      }
    })
  }

  forward(name: string, payload: unknown, context: EventsHandlerContext): void {
    this.events.forward(name, payload, context)
  }

  reply(context: EventsHandlerContext, payload: unknown): void {
    this.events.reply(context, payload)
  }

  // Module APIs will be attached here
  [key: string]: unknown
}
