import {
  EventoHandler,
  EventoHandlerContext,
  EventoUnsubscribe,
  EventoMeta,
  EventoRegistry,
  EventoRegistryEntry,
} from "./types"
import { isWildcard, splitSegments, matchPattern } from "./utils"

export type EventoMetaType<T> =
  T extends Evento<infer L, infer R> ? { environment: L | R[number] } : never

export const MAX_EVENT_DEPTH = 25
export const DEPTH_WARNING_THRESHOLD = 20

type VoidKeys<T> = {
  [K in keyof T]: T[K] extends void ? K : never
}[keyof T]

type NonVoidKeys<T> = {
  [K in keyof T]: T[K] extends void ? never : K
}[keyof T]

// Internal handler entry with metadata
type HandlerEntry<E extends string> = {
  handler: EventoHandler<E>
  once: boolean
}

// Wildcard pattern entry
type WildcardEntry<E extends string> = {
  pattern: string
  segments: string[]
  handler: EventoHandler<E>
  once: boolean
}

export class Evento<
  const Local extends string,
  const Remotes extends string[] = [],
  EventMap extends Record<string, unknown> = Record<string, unknown>,
> {
  private events: Map<string, HandlerEntry<Local | Remotes[number]>[]> = new Map()
  private wildcards: WildcardEntry<Local | Remotes[number]>[] = []
  private registry: Map<string, EventoRegistryEntry> = new Map()
  public sender?: (data: {
    name: string
    payload: unknown
    meta: EventoMeta<Local | Remotes[number]>
  }) => void
  private meta: EventoMeta<Local>

  constructor(local: Local, ..._remotes: Remotes) {
    this.meta = {
      environment: local,
      source: `${local}:init`,
      depth: 0,
      trace_id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
  }

  /**
   * Register events with their Zod schemas
   * Can be called multiple times to add more events
   */
  register(events: EventoRegistry): void {
    for (const [name, entry] of Object.entries(events)) {
      this.registry.set(name, entry)
    }
  }

  /**
   * Get schema for an event
   */
  getSchema(name: string): EventoRegistryEntry | undefined {
    return this.registry.get(name)
  }

  /**
   * Serialize Zod schema to JSON description
   */
  serializeSchema(
    name: string,
  ): { type: string; properties?: Record<string, { type: string }> } | null {
    const entry = this.registry.get(name)
    if (!entry) return null

    const schema = entry.schema
    const def = (schema as any)._def
    const typeName = def?.type || schema.constructor?.name

    // Handle void
    if (typeName === "void" || typeName === "ZodVoid" || typeName === "ZodUndefined") {
      return { type: "void" }
    }

    // Handle object
    if (typeName === "object" || typeName === "ZodObject") {
      const shape = def.shape || (schema as any).shape
      const properties: Record<string, { type: string }> = {}
      const shapeObj = typeof shape === "function" ? shape() : shape
      for (const [key, value] of Object.entries(shapeObj || {})) {
        const fieldSchema = value as any
        const fieldDef = fieldSchema._def || fieldSchema.def
        const fieldType = fieldDef?.type || "unknown"
        properties[key] = { type: fieldType }
      }
      return { type: "object", properties }
    }

    // Handle primitives
    if (typeName === "string" || typeName === "ZodString") return { type: "string" }
    if (typeName === "number" || typeName === "ZodNumber") return { type: "number" }
    if (typeName === "boolean" || typeName === "ZodBoolean") return { type: "boolean" }

    return { type: "unknown" }
  }

  /**
   * Validate event name and payload against registry
   */
  private _validate(name: string, payload: unknown): { valid: boolean; error?: string } {
    const entry = this.registry.get(name)
    if (!entry) {
      return { valid: false, error: `Event "${name}" not registered` }
    }
    const result = entry.schema.safeParse(payload)
    if (!result.success) {
      return { valid: false, error: `Validation failed for "${name}": ${result.error.message}` }
    }
    return { valid: true }
  }

  /**
   * Emit validation error via evento:error
   */
  private _emitValidationError(name: string, message: string): void {
    const errorMeta: EventoMeta<Local> = {
      environment: this.meta.environment,
      source: "evento:validator",
      depth: 0,
      trace_id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    this._emitLocal(
      "evento:error",
      {
        error: {
          code: "VALIDATION_ERROR",
          message,
          details: { event_name: name },
        },
      },
      errorMeta,
    )
  }

  /**
   * Subscribe to an event by exact name or wildcard pattern
   * Returns unsubscribe function
   *
   * Patterns:
   *   - "user:login" - exact match
   *   - "user:*" - any single segment (user:login, user:logout)
   *   - "user:**" - any segments (user:login, user:profile:update)
   *   - "*:update" - any namespace ending with update
   *   - "**:*:error" - any path ending with error
   */
  on<K extends keyof EventMap>(
    name: K,
    handler: EventoHandler<Local | Remotes[number], EventMap[K]>,
  ): EventoUnsubscribe
  on(name: string, handler: EventoHandler<Local | Remotes[number]>): EventoUnsubscribe
  on(
    name: string | keyof EventMap,
    handler: EventoHandler<Local | Remotes[number], any>,
  ): EventoUnsubscribe {
    return this._subscribe(name as string, handler as EventoHandler<Local | Remotes[number]>, false)
  }

  /**
   * Subscribe to an event once, auto-unsubscribe after first call
   */
  once<K extends keyof EventMap>(
    name: K,
    handler: EventoHandler<Local | Remotes[number], EventMap[K]>,
  ): EventoUnsubscribe
  once(name: string, handler: EventoHandler<Local | Remotes[number]>): EventoUnsubscribe
  once(
    name: string | keyof EventMap,
    handler: EventoHandler<Local | Remotes[number], any>,
  ): EventoUnsubscribe {
    return this._subscribe(name as string, handler as EventoHandler<Local | Remotes[number]>, true)
  }

  /**
   * Internal subscribe implementation
   */
  private _subscribe(
    name: string,
    handler: EventoHandler<Local | Remotes[number]>,
    once: boolean,
  ): EventoUnsubscribe {
    if (!name || typeof name !== "string") {
      throw new Error("Event name must be a non-empty string")
    }

    // Check if it's a wildcard pattern
    if (isWildcard(name)) {
      return this._addWildcard(name, handler, once)
    }

    // Exact match subscription
    if (!this.events.has(name)) {
      this.events.set(name, [])
    }

    const entry: HandlerEntry<Local | Remotes[number]> = {
      handler,
      once,
    }
    this.events.get(name)!.push(entry)

    // Return unsubscribe function
    return () => {
      const handlers = this.events.get(name)
      if (handlers) {
        const index = handlers.indexOf(entry)
        if (index > -1) {
          handlers.splice(index, 1)
        }
        if (handlers.length === 0) {
          this.events.delete(name)
        }
      }
    }
  }

  /**
   * Unsubscribe a specific handler from all events
   */
  off(handler: EventoHandler<Local | Remotes[number]>): void {
    // Remove from exact events
    for (const [name, handlers] of this.events.entries()) {
      const index = handlers.findIndex((entry) => entry.handler === handler)
      if (index > -1) {
        handlers.splice(index, 1)
        if (handlers.length === 0) {
          this.events.delete(name)
        }
      }
    }

    // Remove from wildcards
    this.wildcards = this.wildcards.filter((w) => w.handler !== handler)
  }

  /**
   * Unsubscribe all handlers from an event
   */
  offAll(name?: string): void {
    if (name) {
      if (isWildcard(name)) {
        // Remove all wildcards matching this pattern
        this.wildcards = this.wildcards.filter((w) => w.pattern !== name)
      } else {
        this.events.delete(name)
      }
    } else {
      this.events.clear()
      this.wildcards = []
    }
  }

  /**
   * Emit an event with full EventPayload schema
   * Merges user payload with auto-generated EventMeta
   * Only source is required, rest is auto-generated
   */
  emitEvent<K extends NonVoidKeys<EventMap>>(name: K, payload: EventMap[K], source: string): void
  emitEvent<K extends VoidKeys<EventMap>>(name: K, source: string): void
  emitEvent(name: string, payload: unknown, source?: string): void {
    // If only 2 args, second is source (void event)
    const eventSource = source ?? (payload as unknown as string)
    const eventPayload = source ? payload : undefined

    const validation = this._validate(name, eventPayload)
    if (!validation.valid) {
      this._emitValidationError(name, validation.error!)
      return
    }

    const traceId = crypto.randomUUID()

    if (!this._checkDepth(name, 0, traceId)) return

    const eventMeta: EventoMeta<Local> = {
      environment: this.meta.environment,
      source: eventSource,
      depth: 0,
      trace_id: traceId,
      timestamp: Date.now(),
    }

    this._emitLocal(name, eventPayload, eventMeta)
    if (!this.sender) return
    this.sender({ name, payload: eventPayload, meta: eventMeta })
  }

  /**
   * Forward an event from handler context
   * Automatically increments depth and preserves trace_id/source
   */
  forward<K extends NonVoidKeys<EventMap>>(
    name: K,
    payload: EventMap[K],
    context: EventoHandlerContext<Local | Remotes[number]>,
  ): void
  forward<K extends VoidKeys<EventMap>>(
    name: K,
    context: EventoHandlerContext<Local | Remotes[number]>,
  ): void
  forward(
    name: string,
    payload: unknown,
    context?: EventoHandlerContext<Local | Remotes[number]>,
  ): void {
    // Handle void case: forward(name, context)
    const ctx = context ?? (payload as EventoHandlerContext<Local | Remotes[number]>)
    const userPayload = context ? payload : undefined

    const validation = this._validate(name, userPayload)
    if (!validation.valid) {
      this._emitValidationError(name, validation.error!)
      return
    }

    const nextDepth = ctx.meta.depth + 1

    if (!this._checkDepth(name, nextDepth, ctx.meta.trace_id)) return

    const eventMeta: EventoMeta<Local> = {
      environment: this.meta.environment,
      source: ctx.meta.source,
      depth: nextDepth,
      trace_id: ctx.meta.trace_id,
      timestamp: Date.now(),
    }

    this._emitLocal(name, userPayload, eventMeta)
    if (!this.sender) return
    this.sender({ name, payload: userPayload, meta: eventMeta })
  }

  /**
   * Check event depth and warn/reject if limit exceeded
   */
  private _checkDepth(name: string, depth: number, trace_id: string): boolean {
    if (depth >= MAX_EVENT_DEPTH) {
      console.warn(`DEPTH_EXCEEDED: event "${name}" rejected at depth ${depth}`)
      const errorMeta: EventoMeta<Local> = {
        environment: this.meta.environment,
        source: "evento:loop_detector",
        depth,
        trace_id,
        timestamp: Date.now(),
      }
      this._emitLocal(
        "evento:error",
        {
          error: {
            code: "DEPTH_EXCEEDED",
            message: `Event "${name}" rejected: maximum event depth (${MAX_EVENT_DEPTH}) exceeded`,
            details: { event_name: name, depth, trace_id },
          },
        },
        errorMeta,
      )
      return false
    }

    if (depth >= DEPTH_WARNING_THRESHOLD) {
      console.warn(
        `DEPTH_WARNING: "${name}" at depth ${depth}, approaching limit ${MAX_EVENT_DEPTH}`,
      )
    }

    return true
  }

  /**
   * Request-Response pattern
   * Sends a request and waits for response with matching correlation_id
   */
  request<T = unknown, R = unknown>(
    name: string,
    payload: T,
    options?: { timeout?: number },
  ): Promise<{ data: R; correlation_id: string }> {
    const correlationId = crypto.randomUUID()
    const responseEvent = `${name}:response`
    const timeout = options?.timeout ?? 1000

    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      let resolved = false

      const unsubscribe = this.on(responseEvent, (ctx) => {
        const responsePayload = ctx.payload as { correlation_id?: string; data: R }
        if (responsePayload.correlation_id === correlationId) {
          resolved = true
          if (timeoutId) clearTimeout(timeoutId)
          unsubscribe()
          resolve({
            data: responsePayload.data,
            correlation_id: correlationId,
          })
        }
      })

      timeoutId = setTimeout(() => {
        if (!resolved) {
          unsubscribe()
          reject(new Error("TIMEOUT"))
        }
      }, timeout)

      // Send request with correlation_id
      this._emitRequest(name, payload, correlationId)
    })
  }

  /**
   * Internal emit for request payload with correlation_id
   */
  private _emitRequest<T>(name: string, payload: T, correlationId: string): void {
    const requestPayload =
      payload !== undefined && payload !== null
        ? { ...(payload as Record<string, unknown>), correlation_id: correlationId }
        : { correlation_id: correlationId }

    ;(this as any).emitEvent(name, requestPayload as any, `${name}:request`)
  }

  /**
   * Reply to a request
   * Automatically includes correlation_id from request context
   */
  reply<T = unknown>(context: EventoHandlerContext<Local | Remotes[number]>, payload: T): void {
    const correlationId = (context.payload as any).correlation_id
    const responseEvent = `${context.name}:response`

    const eventPayload = {
      ...(payload as object),
      correlation_id: correlationId,
    }

    const validation = this._validate(responseEvent, eventPayload)
    if (!validation.valid) {
      this._emitValidationError(responseEvent, validation.error!)
      return
    }

    const nextDepth = context.meta.depth + 1

    if (!this._checkDepth(responseEvent, nextDepth, context.meta.trace_id)) return

    const eventMeta: EventoMeta<Local> = {
      environment: this.meta.environment,
      source: context.meta.source,
      depth: nextDepth,
      trace_id: context.meta.trace_id,
      timestamp: Date.now(),
    }

    this._emitLocal(responseEvent, eventPayload, eventMeta)
    if (!this.sender) return
    this.sender({ name: responseEvent, payload: eventPayload, meta: eventMeta })
  }

  /**
   * Internal emit (from RPC) - public for adapter usage
   */
  emitLocal(
    name: string,
    payload: unknown,
    meta: Partial<EventoMeta<Local | Remotes[number]>>,
  ): void {
    const fullMeta: EventoMeta<Local | Remotes[number]> = {
      environment: meta.environment ?? this.meta.environment,
      source: meta.source ?? this.meta.source,
      depth: meta.depth ?? 0,
      trace_id: meta.trace_id ?? crypto.randomUUID(),
      timestamp: meta.timestamp ?? Date.now(),
    }
    this._emitLocal(name, payload, fullMeta)
  }

  /**
   * Internal emit implementation
   */
  private _emitLocal(
    name: string,
    payload: unknown,
    meta: EventoMeta<Local | Remotes[number]>,
  ): void {
    const segments = splitSegments(name)
    const context: EventoHandlerContext<Local | Remotes[number]> = {
      name,
      payload,
      meta,
      segments,
    }

    // Process exact match handlers
    this._processHandlers(this.events.get(name), context)

    // Process wildcard handlers
    const matchedWildcards = this._matchWildcards(segments)
    this._processWildcards(matchedWildcards, context)
  }

  /**
   * Process handler entries and remove once handlers
   */
  private _processHandlers(
    handlers: HandlerEntry<Local | Remotes[number]>[] | undefined,
    context: EventoHandlerContext<Local | Remotes[number]>,
  ): void {
    if (!handlers) return

    const onceHandlers: HandlerEntry<Local | Remotes[number]>[] = []

    for (const entry of handlers) {
      try {
        entry.handler(context)
      } catch (error) {
        this._emitError(error, context, entry.handler)
      }
      if (entry.once) {
        onceHandlers.push(entry)
      }
    }

    // Remove once handlers using filter (more efficient than splice in loop)
    if (onceHandlers.length > 0) {
      const filtered = handlers.filter((h) => !onceHandlers.includes(h))
      handlers.length = 0
      handlers.push(...filtered)
    }

    if (handlers.length === 0) {
      this.events.delete(context.name)
    }
  }

  /**
   * Emit error event when handler throws
   */
  private _emitError(
    error: unknown,
    context: EventoHandlerContext<Local | Remotes[number]>,
    handler: EventoHandler<Local | Remotes[number]>,
  ): void {
    const errorMeta: EventoMeta<Local> = {
      environment: this.meta.environment,
      source: "evento:error_handler",
      depth: context.meta.depth,
      trace_id: context.meta.trace_id,
      timestamp: Date.now(),
    }

    this._emitLocal(
      "evento:error",
      {
        error: {
          code: "HANDLER_ERROR",
          message: error instanceof Error ? error.message : String(error),
          details: {
            event_name: context.name,
            handler_name: handler.name || "anonymous",
          },
        },
      },
      errorMeta,
    )
  }

  /**
   * Process wildcard entries and remove once handlers
   */
  private _processWildcards(
    wildcards: WildcardEntry<Local | Remotes[number]>[],
    context: EventoHandlerContext<Local | Remotes[number]>,
  ): void {
    const onceWildcards: WildcardEntry<Local | Remotes[number]>[] = []

    for (const entry of wildcards) {
      try {
        entry.handler(context)
      } catch (error) {
        this._emitError(error, context, entry.handler)
      }
      if (entry.once) {
        onceWildcards.push(entry)
      }
    }

    // Remove once wildcards using filter
    if (onceWildcards.length > 0) {
      this.wildcards = this.wildcards.filter((w) => !onceWildcards.includes(w))
    }
  }

  /**
   * Add a wildcard pattern subscription
   */
  private _addWildcard(
    pattern: string,
    handler: EventoHandler<Local | Remotes[number]>,
    once: boolean,
  ): EventoUnsubscribe {
    const segments = splitSegments(pattern)
    const entry: WildcardEntry<Local | Remotes[number]> = {
      pattern,
      segments,
      handler,
      once,
    }
    this.wildcards.push(entry)

    return () => {
      const index = this.wildcards.indexOf(entry)
      if (index > -1) {
        this.wildcards.splice(index, 1)
      }
    }
  }

  /**
   * Match event segments against wildcard patterns
   */
  private _matchWildcards(eventSegments: string[]): WildcardEntry<Local | Remotes[number]>[] {
    return this.wildcards.filter((entry) => matchPattern(eventSegments, entry.segments))
  }

  /**
   * Check if there are any listeners for the given event name
   * Includes both exact matches and wildcard patterns
   */
  hasListeners(name: string): boolean {
    if (!name || typeof name !== "string") {
      return false
    }

    // Check exact match
    if (this.events.has(name) && (this.events.get(name)?.length ?? 0) > 0) {
      return true
    }

    // Check wildcard patterns
    const segments = splitSegments(name)
    return this._matchWildcards(segments).length > 0
  }

  /**
   * Get debug information about current event bus state
   * Returns read-only snapshot of listeners and wildcards
   */
  getDebugInfo(): {
    exact: Array<{ name: string; count: number }>
    wildcards: Array<{ pattern: string; count: number }>
    registry: Array<{ name: string; description?: string }>
    environment: Local
  } {
    const exact: Array<{ name: string; count: number }> = []
    for (const [name, handlers] of this.events.entries()) {
      exact.push({ name, count: handlers.length })
    }

    const wildcards = this.wildcards.map((w) => ({
      pattern: w.pattern,
      count: 1,
    }))

    const registry = Array.from(this.registry.entries()).map(([name, entry]) => ({
      name,
      description: entry.description,
    }))

    return {
      exact,
      wildcards,
      registry,
      environment: this.meta.environment,
    }
  }
}
