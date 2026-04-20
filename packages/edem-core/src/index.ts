/**
 * Edem Core — Module registration and event communication foundation.
 *
 * Provides:
 * - Evento interface: type-safe event bus for module communication
 * - Core class: module registry and lifecycle orchestration
 * - Tracing utilities: trace IDs, event metadata, depth tracking
 * - Loop detection: protection against infinite event loops
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Event metadata attached to every event for tracing and loop detection.
 */
export interface EventMeta {
  /** Who initiated: "{origin}:{id}" e.g. "user:ui", "flows:run_abc123" */
  source: string
  /** Loop protection: 0–MAX_EVENT_DEPTH */
  depth: number
  /** UUID linking the entire event chain */
  trace_id: string
  /** Unix timestamp in milliseconds */
  timestamp: number
}

/**
 * Context passed to every event handler.
 */
export interface EventContext {
  /** Event type: "data:create_item" */
  type: string
  /** Event payload */
  payload: unknown
  /** Tracing metadata */
  meta: EventMeta
}

/** Handler for fire-and-forget events. */
export type EventHandler = (ctx: EventContext) => void | Promise<void>

/** Handler for request-response events. Must return a value. */
export type RequestHandler = (ctx: EventContext) => unknown | Promise<unknown>

/**
 * Event bus interface. Implementations provided by the host application
 * (e.g. in-memory for Bun-side, RPC bridge for webview-side).
 */
export interface Evento {
  /**
   * Emit a fire-and-forget event.
   * Handlers are called synchronously in registration order.
   */
  emit(type: string, payload: unknown, meta?: Partial<EventMeta>): void

  /**
   * Listen to events of a given type.
   * Returns an unsubscribe function.
   */
  on(type: string, handler: EventHandler): () => void

  /**
   * Register a handler for request-response events.
   * Only one handler per type. Returns an unsubscribe function.
   */
  handle(type: string, handler: RequestHandler): () => void

  /**
   * Send a request and wait for a response.
   * Uses correlation_id under the hood.
   */
  request(
    type: string,
    payload: unknown,
    meta?: Partial<EventMeta>,
    timeout?: number,
  ): Promise<unknown>
}

/**
 * Module interface. Every edem module exports this.
 */
export interface Module {
  /** Module name: "data", "flows", "ui", etc. */
  name: string

  /**
   * Initialize the module with an Evento instance.
   * Called by Core during startup.
   */
  init(evento: Evento): void | Promise<void>
}

// =============================================================================
// LOOP DETECTION
// =============================================================================

/** Maximum event depth before rejection. */
export const MAX_EVENT_DEPTH = 25

/** Depth at which a warning is logged. */
export const DEPTH_WARNING_THRESHOLD = 20

/** Result of depth check. */
export interface DepthCheck {
  ok: boolean
  warning?: boolean
}

/**
 * Check if event depth is within limits.
 */
export function checkDepth(depth: number): DepthCheck {
  if (depth >= MAX_EVENT_DEPTH) {
    return { ok: false }
  }
  if (depth >= DEPTH_WARNING_THRESHOLD) {
    return { ok: true, warning: true }
  }
  return { ok: true }
}

// =============================================================================
// TRACING UTILITIES
// =============================================================================

/**
 * Generate a new trace ID (UUID v4).
 */
export function createTraceId(): string {
  return crypto.randomUUID()
}

/**
 * Create fresh event metadata for a new event chain.
 */
export function createEventMeta(source: string): EventMeta {
  return {
    source,
    depth: 0,
    trace_id: createTraceId(),
    timestamp: Date.now(),
  }
}

/**
 * Increment depth for forwarding an event.
 */
export function nextDepth(meta: EventMeta): EventMeta {
  return {
    ...meta,
    depth: meta.depth + 1,
    timestamp: Date.now(),
  }
}

// =============================================================================
// IN-MEMORY EVENTO IMPLEMENTATION (Bun-side)
// =============================================================================

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * In-memory Evento implementation for Bun-side.
 *
 * - Synchronous handler invocation
 * - Request-response via correlation_id
 * - Loop detection with depth checking
 * - No event loss (in-memory)
 */
export class EventoBun implements Evento {
  private handlers = new Map<string, Set<EventHandler>>()
  private requestHandlers = new Map<string, RequestHandler>()
  private pendingRequests = new Map<string, PendingRequest>()
  private defaultTimeout = 5000

  emit(type: string, payload: unknown, meta?: Partial<EventMeta>): void {
    const fullMeta = this.ensureMeta(meta)

    const check = checkDepth(fullMeta.depth)
    if (!check.ok) {
      console.warn(`[Evento] DEPTH_EXCEEDED: ${type} at depth ${fullMeta.depth}`)
      return
    }
    if (check.warning) {
      console.warn(`[Evento] Approaching depth limit: ${type} at depth ${fullMeta.depth}`)
    }

    const ctx: EventContext = { type, payload, meta: fullMeta }

    const handlers = this.handlers.get(type)
    if (handlers) {
      for (const handler of handlers) {
        try {
          const result = handler(ctx)
          if (result instanceof Promise) {
            result.catch((err) => {
              console.error(`[Evento] Async handler error for ${type}:`, err)
            })
          }
        } catch (err) {
          console.error(`[Evento] Handler error for ${type}:`, err)
        }
      }
    }
  }

  on(type: string, handler: EventHandler): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler)

    return () => {
      set?.delete(handler)
      if (set?.size === 0) {
        this.handlers.delete(type)
      }
    }
  }

  handle(type: string, handler: RequestHandler): () => void {
    if (this.requestHandlers.has(type)) {
      console.warn(`[Evento] Handler for ${type} already registered, overwriting`)
    }
    this.requestHandlers.set(type, handler)

    return () => {
      this.requestHandlers.delete(type)
    }
  }

  request(
    type: string,
    payload: unknown,
    meta?: Partial<EventMeta>,
    timeout = this.defaultTimeout,
  ): Promise<unknown> {
    const correlationId = crypto.randomUUID()
    const fullMeta = this.ensureMeta(meta)

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(correlationId)
        reject(new Error(`[Evento] Request timeout: ${type}`))
      }, timeout)

      this.pendingRequests.set(correlationId, { resolve, reject, timer })

      // Emit the request event
      const requestType = type
      this.emit(requestType, payload, fullMeta)

      // Try to handle synchronously
      const handler = this.requestHandlers.get(requestType)
      if (handler) {
        const ctx: EventContext = { type: requestType, payload, meta: fullMeta }
        try {
          const result = handler(ctx)
          const handleResult = (value: unknown) => {
            const pending = this.pendingRequests.get(correlationId)
            if (pending) {
              clearTimeout(pending.timer)
              this.pendingRequests.delete(correlationId)
              pending.resolve(value)
            }
          }
          if (result instanceof Promise) {
            result.then(handleResult).catch((err) => {
              const pending = this.pendingRequests.get(correlationId)
              if (pending) {
                clearTimeout(pending.timer)
                this.pendingRequests.delete(correlationId)
                pending.reject(err instanceof Error ? err : new Error(String(err)))
              }
            })
          } else {
            handleResult(result)
          }
        } catch (err) {
          const pending = this.pendingRequests.get(correlationId)
          if (pending) {
            clearTimeout(pending.timer)
            this.pendingRequests.delete(correlationId)
            pending.reject(err instanceof Error ? err : new Error(String(err)))
          }
        }
      }
    })
  }

  private ensureMeta(partial?: Partial<EventMeta>): EventMeta {
    if (partial?.trace_id && partial.source !== undefined && partial.depth !== undefined) {
      return {
        source: partial.source,
        depth: partial.depth,
        trace_id: partial.trace_id,
        timestamp: partial.timestamp ?? Date.now(),
      }
    }
    return createEventMeta(partial?.source ?? "system:unknown")
  }
}

// =============================================================================
// CORE — MODULE REGISTRY
// =============================================================================

/**
 * Core orchestrates module registration and initialization.
 *
 * Usage:
 * ```ts
 * const core = new Core()
 * core.register(dataModule)
 * core.register(flowsModule)
 * await core.init()
 * ```
 */
export class Core {
  private modules = new Map<string, Module>()
  private evento: Evento
  private initialized = false

  constructor(evento?: Evento) {
    this.evento = evento ?? new EventoBun()
  }

  /**
   * Register a module. Cannot be called after init().
   */
  register(module: Module): void {
    if (this.initialized) {
      throw new Error(`[Core] Cannot register module "${module.name}" after init()`)
    }
    if (this.modules.has(module.name)) {
      throw new Error(`[Core] Module "${module.name}" already registered`)
    }
    this.modules.set(module.name, module)
  }

  /**
   * Initialize all registered modules in registration order.
   */
  async init(): Promise<void> {
    if (this.initialized) {
      throw new Error("[Core] Already initialized")
    }
    this.initialized = true

    for (const [name, module] of this.modules) {
      try {
        await module.init(this.evento)
      } catch (err) {
        console.error(`[Core] Module "${name}" init failed:`, err)
        throw err
      }
    }
  }

  /**
   * Get the Evento instance.
   */
  getEvento(): Evento {
    return this.evento
  }

  /**
   * Get registered module names.
   */
  getModuleNames(): string[] {
    return Array.from(this.modules.keys())
  }
}
