import {
  EventoEnvironment,
  EventoHandler,
  EventoHandlerContext,
  EventoMeta,
  EventoRPCEmit,
  EventoUnsubscribe,
} from "./types";
import { isWildcard, splitSegments, matchPattern } from "./utils";

// Internal handler entry with metadata
type HandlerEntry = {
  handler: EventoHandler;
  once: boolean;
};

// Wildcard pattern entry
type WildcardEntry = {
  pattern: string;
  segments: string[];
  handler: EventoHandler;
  once: boolean;
};

export class Evento {
  private events: Map<string, HandlerEntry[]> = new Map();
  private wildcards: WildcardEntry[] = [];
  public sender?: (data: EventoRPCEmit) => void;
  private meta: EventoMeta;

  constructor({ environment }: { environment: EventoEnvironment }) {
    this.meta = { environment };
  }

  /**
   * Subscribe to an event by exact name or wildcard pattern
   * Returns unsubscribe function
   *
   * Patterns:
   * - "user:login" - exact match
   * - "user:*" - any single segment (user:login, user:logout)
   * - "user:**" - any segments (user:login, user:profile:update)
   * - "*:update" - any namespace ending with update
   * - "**:*:error" - any path ending with error
   */
  on(name: string, handler: EventoHandler): EventoUnsubscribe {
    return this._subscribe(name, handler, false);
  }

  /**
   * Subscribe to an event once, auto-unsubscribe after first call
   */
  once(name: string, handler: EventoHandler): EventoUnsubscribe {
    return this._subscribe(name, handler, true);
  }

  /**
   * Internal subscribe implementation
   */
  private _subscribe(
    name: string,
    handler: EventoHandler,
    once: boolean
  ): EventoUnsubscribe {
    // Check if it's a wildcard pattern
    if (isWildcard(name)) {
      return this._addWildcard(name, handler, once);
    }

    // Exact match subscription
    if (!this.events.has(name)) {
      this.events.set(name, []);
    }

    const entry: HandlerEntry = { handler, once };
    this.events.get(name)!.push(entry);

    // Return unsubscribe function
    return () => {
      const handlers = this.events.get(name);
      if (handlers) {
        const index = handlers.indexOf(entry);
        if (index > -1) {
          handlers.splice(index, 1);
        }
        if (handlers.length === 0) {
          this.events.delete(name);
        }
      }
    };
  }

  /**
   * Unsubscribe a specific handler from all events
   */
  off(handler: EventoHandler): void {
    // Remove from exact events
    for (const [name, handlers] of this.events.entries()) {
      const index = handlers.findIndex((entry) => entry.handler === handler);
      if (index > -1) {
        handlers.splice(index, 1);
        if (handlers.length === 0) {
          this.events.delete(name);
        }
      }
    }

    // Remove from wildcards
    this.wildcards = this.wildcards.filter((w) => w.handler !== handler);
  }

  /**
   * Unsubscribe all handlers from an event
   */
  offAll(name?: string): void {
    if (name) {
      if (isWildcard(name)) {
        // Remove all wildcards matching this pattern
        this.wildcards = this.wildcards.filter((w) => w.pattern !== name);
      } else {
        this.events.delete(name);
      }
    } else {
      this.events.clear();
      this.wildcards = [];
    }
  }

  /**
   * Emit an event
   */
  emit(name: string, payload?: unknown): void {
    this._emitLocal(name, payload, this.meta);

    if (!this.sender) {
      console.log("Evento", "Emit: sender not found");
      return;
    }

    this.sender({ name, payload, meta: this.meta });
  }

  /**
   * Internal emit (from RPC) - public for adapter usage
   */
  emitLocal(name: string, payload: unknown, meta: EventoMeta): void {
    this._emitLocal(name, payload, meta);
  }

  /**
   * Internal emit implementation
   */
  private _emitLocal(name: string, payload: unknown, meta: EventoMeta): void {
    const segments = splitSegments(name);
    const context: EventoHandlerContext = { name, payload, meta, segments };

    // Process exact match handlers
    this._processHandlers(this.events.get(name), context);

    // Process wildcard handlers
    const matchedWildcards = this._matchWildcards(segments);
    this._processWildcards(matchedWildcards, context);

    console.log("Evento", { name, payload, meta });
  }

  /**
   * Process handler entries and remove once handlers
   */
  private _processHandlers(
    handlers: HandlerEntry[] | undefined,
    context: EventoHandlerContext
  ): void {
    if (!handlers) return;

    const onceHandlers: HandlerEntry[] = [];

    for (const entry of [...handlers]) {
      entry.handler(context);
      if (entry.once) {
        onceHandlers.push(entry);
      }
    }

    // Remove once handlers
    for (const entry of onceHandlers) {
      const index = handlers.indexOf(entry);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }

    if (handlers.length === 0) {
      this.events.delete(context.name);
    }
  }

  /**
   * Process wildcard entries and remove once handlers
   */
  private _processWildcards(
    wildcards: WildcardEntry[],
    context: EventoHandlerContext
  ): void {
    const onceWildcards: WildcardEntry[] = [];

    for (const entry of wildcards) {
      entry.handler(context);
      if (entry.once) {
        onceWildcards.push(entry);
      }
    }

    // Remove once wildcards
    for (const entry of onceWildcards) {
      const index = this.wildcards.indexOf(entry);
      if (index > -1) {
        this.wildcards.splice(index, 1);
      }
    }
  }

  /**
   * Add a wildcard pattern subscription
   */
  private _addWildcard(
    pattern: string,
    handler: EventoHandler,
    once: boolean
  ): EventoUnsubscribe {
    const segments = splitSegments(pattern);
    const entry: WildcardEntry = { pattern, segments, handler, once };
    this.wildcards.push(entry);

    return () => {
      const index = this.wildcards.indexOf(entry);
      if (index > -1) {
        this.wildcards.splice(index, 1);
      }
    };
  }

  /**
   * Match event segments against wildcard patterns
   */
  private _matchWildcards(eventSegments: string[]): WildcardEntry[] {
    return this.wildcards.filter((entry) =>
      matchPattern(eventSegments, entry.segments)
    );
  }
}
