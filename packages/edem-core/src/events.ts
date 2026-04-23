/**
 * Events — Full-featured event bus with Zod schema validation, wildcard patterns,
 * request-response, and loop detection.
 *
 * This is the core event bus implementation. For Bun-side usage, see EventsBun
 * which provides a simpler in-memory interface.
 */

// =============================================================================
// TYPES
// =============================================================================

export type EventMeta = {
  source: string
  depth: number
  trace_id: string
  timestamp: number
}

export type EventsMeta<E extends string = string> = EventMeta & {
  environment: E
}

// Extended handler with segments
export type EventsHandlerContext<E extends string = string, P = unknown> = {
  name: string
  payload: P
  meta: EventsMeta<E>
  segments: string[]
}

export type EventsHandler<E extends string = string, P = unknown> = (
  context: EventsHandlerContext<E, P>,
) => void

export type EventsUnsubscribe = () => void

export type EventsRegistryEntry = {
  schema: import("zod").ZodTypeAny
  response?: import("zod").ZodTypeAny
}

export type EventsRegistry = Record<string, EventsRegistryEntry>

// =============================================================================
// CONSTANTS
// =============================================================================

export const MAX_EVENT_DEPTH = 25
export const DEPTH_WARNING_THRESHOLD = 20

// =============================================================================
// TRACING UTILITIES
// =============================================================================

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
// WILDCARD UTILITIES
// =============================================================================

/**
 * Check if a string contains wildcard characters
 */
export function isWildcard(pattern: string): boolean {
  return pattern.includes("*")
}

/**
 * Split event name or pattern into segments
 */
export function splitSegments(name: string): string[] {
  return name.split(":")
}

/**
 * Match event segments against pattern segments
 * Supports: * (single segment) and ** (any segments)
 */
export function matchPattern(eventSegments: string[], patternSegments: string[]): boolean {
  let eventIdx = 0
  let patternIdx = 0

  while (patternIdx < patternSegments.length) {
    const patternSeg = patternSegments[patternIdx]

    if (patternSeg === "**") {
      // ** matches any remaining segments
      if (patternIdx === patternSegments.length - 1) {
        // ** at the end matches everything
        return true
      }

      // Look ahead to find where to continue matching
      const nextPatternSeg = patternSegments[patternIdx + 1]
      while (eventIdx < eventSegments.length) {
        if (
          nextPatternSeg === "*" ||
          nextPatternSeg === "**" ||
          eventSegments[eventIdx] === nextPatternSeg
        ) {
          break
        }
        eventIdx++
      }

      patternIdx++
    } else if (patternSeg === "*") {
      // * matches exactly one segment
      if (eventIdx >= eventSegments.length) {
        return false
      }
      eventIdx++
      patternIdx++
    } else {
      // Exact match required
      if (eventIdx >= eventSegments.length || eventSegments[eventIdx] !== patternSeg) {
        return false
      }
      eventIdx++
      patternIdx++
    }
  }

  // All pattern segments consumed, check if all event segments consumed too
  return eventIdx === eventSegments.length
}

// =============================================================================
// REGISTRY
// =============================================================================

export function createRegistry<
  const N extends string,
  const T extends Record<string, EventsRegistryEntry>,
>(namespace: N, events: T): { [K in keyof T as `${N}:${K & string}`]: T[K] } {
  const result = {} as Record<string, EventsRegistryEntry>
  for (const [key, value] of Object.entries(events)) {
    const fullKey = `${namespace}:${key}`
    result[fullKey] = value
    if (value.response) {
      result[`${fullKey}:response`] = { schema: value.response }
    }
  }
  return result as { [K in keyof T as `${N}:${K & string}`]: T[K] }
}

// =============================================================================
// EVENTS CLASS
// =============================================================================

export type EventsMetaType<T> =
  // oxlint-disable-next-line no-unused-vars
  T extends Events<infer L, infer R, infer _Map> ? { environment: L | R[number] } : never

type VoidKeys<T> = {
  [K in keyof T]: T[K] extends void ? K : never
}[keyof T]

type NonVoidKeys<T> = {
  [K in keyof T]: T[K] extends void ? never : K
}[keyof T]

type RequestResponseType<EventMap, K extends string> = `${K}:response` extends keyof EventMap
  ? EventMap[`${K}:response`]
  : unknown

// Internal handler entry with metadata
type HandlerEntry<E extends string> = {
  handler: EventsHandler<E>
  once: boolean
}

// Wildcard pattern entry
type WildcardEntry<E extends string> = {
  pattern: string
  segments: string[]
  handler: EventsHandler<E>
  once: boolean
}

export class Events<
  const Local extends string,
  const Remotes extends string[] = [],
  EventMap extends Record<string, unknown> = Record<string, unknown>,
> {
  private events: Map<string, HandlerEntry<Local | Remotes[number]>[]> = new Map()
  private wildcards: WildcardEntry<Local | Remotes[number]>[] = []
  private registry: Map<string, EventsRegistryEntry> = new Map()
  private requestEvents: Set<string> = new Set()
  private responseEvents: Set<string> = new Set()
  public sender?: (data: {
    name: string
    payload: unknown
    meta: EventsMeta<Local | Remotes[number]>
  }) => void
  private meta: EventsMeta<Local>

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
  register(events: EventsRegistry): void {
    for (const [name, entry] of Object.entries(events)) {
      this.registry.set(name, entry)
      if (entry.response) {
        this.requestEvents.add(name)
        const responseName = `${name}:response`
        this.registry.set(responseName, { schema: entry.response })
        this.responseEvents.add(responseName)
      }
    }
  }

  /**
   * Get schema for an event
   */
  getSchema(name: string): EventsRegistryEntry | undefined {
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
    const def = (schema as unknown as { _def?: { type?: string; shape?: unknown } })._def
    const typeName = def?.type || schema.constructor?.name

    // Handle void
    if (typeName === "void" || typeName === "ZodVoid" || typeName === "ZodUndefined") {
      return { type: "void" }
    }

    // Handle object
    if (typeName === "object" || typeName === "ZodObject") {
      const shape =
        (def as { shape?: unknown } | undefined)?.shape ??
        (schema as unknown as { shape?: unknown }).shape
      const properties: Record<string, { type: string }> = {}
      const shapeObj = typeof shape === "function" ? shape() : shape
      for (const [key, value] of Object.entries(shapeObj || {})) {
        const fieldSchema = value as { _def?: { type?: string }; def?: { type?: string } }
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
   * For request/response events, correlation_id is stripped before validation
   */
  private _isVoidSchema(schema: unknown): boolean {
    const def = (schema as { _def?: { type?: string } })._def
    const typeName = def?.type || (schema as { constructor?: { name?: string } }).constructor?.name
    return typeName === "void" || typeName === "ZodVoid" || typeName === "ZodUndefined"
  }

  /**
   * Validate event name and payload against registry
   * For request/response events, correlation_id is stripped before validation
   */
  private _validate(name: string, payload: unknown): { valid: boolean; error?: string } {
    const entry = this.registry.get(name)
    if (!entry) {
      // Allow unregistered events (development mode)
      return { valid: true }
    }
    const isRequestOrResponse = this.requestEvents.has(name) || this.responseEvents.has(name)
    let payloadToValidate =
      isRequestOrResponse && payload !== null && typeof payload === "object"
        ? Object.fromEntries(
            Object.entries(payload as object).filter(([k]) => k !== "correlation_id"),
          )
        : payload

    // For void request/response schemas, empty object after stripping correlation_id is valid
    if (
      isRequestOrResponse &&
      this._isVoidSchema(entry.schema) &&
      payloadToValidate !== null &&
      typeof payloadToValidate === "object" &&
      Object.keys(payloadToValidate).length === 0
    ) {
      payloadToValidate = undefined
    }

    const result = entry.schema.safeParse(payloadToValidate)
    if (!result.success) {
      return { valid: false, error: `Validation failed for "${name}": ${result.error.message}` }
    }
    return { valid: true }
  }

  /**
   * Emit validation error via events:error
   */
  private _emitValidationError(name: string, message: string): void {
    const errorMeta: EventsMeta<Local> = {
      environment: this.meta.environment,
      source: "events:validator",
      depth: 0,
      trace_id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    this._emitLocal(
      "events:error",
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
    handler: EventsHandler<Local | Remotes[number], EventMap[K]>,
  ): EventsUnsubscribe
  on(name: string, handler: EventsHandler<Local | Remotes[number]>): EventsUnsubscribe
  on(
    name: string | keyof EventMap,
    handler:
      | EventsHandler<Local | Remotes[number]>
      | EventsHandler<Local | Remotes[number], EventMap[keyof EventMap]>,
  ): EventsUnsubscribe {
    return this._subscribe(name as string, handler as EventsHandler<Local | Remotes[number]>, false)
  }

  /**
   * Subscribe to an event once, auto-unsubscribe after first call
   */
  once<K extends keyof EventMap>(
    name: K,
    handler: EventsHandler<Local | Remotes[number], EventMap[K]>,
  ): EventsUnsubscribe
  once(name: string, handler: EventsHandler<Local | Remotes[number]>): EventsUnsubscribe
  once(
    name: string | keyof EventMap,
    handler:
      | EventsHandler<Local | Remotes[number]>
      | EventsHandler<Local | Remotes[number], EventMap[keyof EventMap]>,
  ): EventsUnsubscribe {
    return this._subscribe(name as string, handler as EventsHandler<Local | Remotes[number]>, true)
  }

  /**
   * Internal subscribe implementation
   */
  private _subscribe(
    name: string,
    handler: EventsHandler<Local | Remotes[number]>,
    once: boolean,
  ): EventsUnsubscribe {
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
  off(handler: EventsHandler<Local | Remotes[number]>): void {
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
  emitEvent(name: string, payload?: unknown, source?: string, traceId?: string): void {
    // If only 2 args, second is source (void event)
    const eventSource = source ?? (typeof payload === "string" ? payload : String(payload))
    const eventPayload = source !== undefined ? payload : undefined

    const validation = this._validate(name, eventPayload)
    if (!validation.valid) {
      this._emitValidationError(name, validation.error!)
      return
    }

    const finalTraceId = traceId ?? crypto.randomUUID()

    if (!this._checkDepth(name, 0, finalTraceId)) return

    const eventMeta: EventsMeta<Local> = {
      environment: this.meta.environment,
      source: eventSource,
      depth: 0,
      trace_id: finalTraceId,
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
    context: EventsHandlerContext<Local | Remotes[number]>,
  ): void
  forward<K extends VoidKeys<EventMap>>(
    name: K,
    context: EventsHandlerContext<Local | Remotes[number]>,
  ): void
  forward(
    name: string,
    payload: unknown,
    context?: EventsHandlerContext<Local | Remotes[number]>,
  ): void {
    // Handle void case: forward(name, context)
    const ctx = context ?? (payload as EventsHandlerContext<Local | Remotes[number]>)
    const userPayload = context ? payload : undefined

    const validation = this._validate(name, userPayload)
    if (!validation.valid) {
      this._emitValidationError(name, validation.error!)
      return
    }

    const nextDepthValue = ctx.meta.depth + 1

    if (!this._checkDepth(name, nextDepthValue, ctx.meta.trace_id)) return

    const eventMeta: EventsMeta<Local> = {
      environment: this.meta.environment,
      source: ctx.meta.source,
      depth: nextDepthValue,
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
      const errorMeta: EventsMeta<Local> = {
        environment: this.meta.environment,
        source: "events:loop_detector",
        depth,
        trace_id,
        timestamp: Date.now(),
      }
      this._emitLocal(
        "events:error",
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
   * Returns the response payload directly (without { data, correlation_id } wrapper)
   */
  request<K extends string>(
    name: K,
    payload: K extends keyof EventMap ? EventMap[K] : unknown,
    options?: { timeout?: number; traceId?: string },
  ): Promise<RequestResponseType<EventMap, K>> {
    const correlationId = crypto.randomUUID()
    const responseEvent = `${name}:response`
    const timeout = options?.timeout ?? 1000
    const traceId = options?.traceId

    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      let resolved = false

      const unsubscribe = this.on(responseEvent, (ctx) => {
        const responsePayload = ctx.payload as { correlation_id?: string }
        if (responsePayload.correlation_id === correlationId) {
          resolved = true
          if (timeoutId) clearTimeout(timeoutId)
          unsubscribe()
          const { correlation_id, ...data } = responsePayload
          void correlation_id
          resolve(data as RequestResponseType<EventMap, K>)
        }
      })

      timeoutId = setTimeout(() => {
        if (!resolved) {
          unsubscribe()
          reject(new Error("TIMEOUT"))
        }
      }, timeout)

      // Send request with correlation_id
      this._emitRequest(name, payload, correlationId, traceId)
    })
  }

  /**
   * Internal emit for request payload with correlation_id
   */
  private _emitRequest<T>(name: string, payload: T, correlationId: string, traceId?: string): void {
    const requestPayload =
      payload !== undefined && payload !== null
        ? { ...(payload as Record<string, unknown>), correlation_id: correlationId }
        : { correlation_id: correlationId }

    this.emitEvent(name, requestPayload, `${name}:request`, traceId)
  }

  /**
   * Reply to a request
   * Automatically includes correlation_id from request context
   * Payload is sent directly (without { data } wrapper)
   */
  reply<T = unknown>(context: EventsHandlerContext<Local | Remotes[number]>, payload: T): void {
    const correlationId = (context.payload as { correlation_id?: string }).correlation_id
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

    const nextDepthValue = context.meta.depth + 1

    if (!this._checkDepth(responseEvent, nextDepthValue, context.meta.trace_id)) return

    const eventMeta: EventsMeta<Local> = {
      environment: this.meta.environment,
      source: context.meta.source,
      depth: nextDepthValue,
      trace_id: context.meta.trace_id,
      timestamp: Date.now(),
    }

    this._emitLocal(responseEvent, eventPayload, eventMeta)
    if (!this.sender) return
    this.sender({ name: responseEvent, payload: eventPayload, meta: eventMeta })
  }

  /**
   * Handle a request event with automatic reply
   * Handler return value is sent as reply payload
   * If handler returns void/undefined, no reply is sent
   */
  handle<K extends keyof EventMap>(
    name: K,
    handler: (
      context: EventsHandlerContext<Local | Remotes[number], EventMap[K]>,
    ) => unknown | Promise<unknown>,
  ): EventsUnsubscribe {
    return this.on(name as string, (ctx) => {
      // Strip correlation_id from payload for handler
      const payload = ctx.payload as Record<string, unknown>
      const { correlation_id, ...cleanPayload } = payload
      void correlation_id
      const handlerCtx = {
        ...ctx,
        payload: cleanPayload as EventsHandlerContext<
          Local | Remotes[number],
          EventMap[K]
        >["payload"],
      }
      const result = handler(handlerCtx)
      if (result === undefined) return
      if (result instanceof Promise) {
        result
          .then((data) => {
            if (data !== undefined) {
              this.reply(ctx, data)
            }
          })
          .catch((error) => {
            this._emitError(error, ctx, handler as EventsHandler<Local | Remotes[number]>)
          })
      } else {
        this.reply(ctx, result)
      }
    })
  }

  /**
   * Internal emit (from RPC) - public for adapter usage
   */
  emitLocal(
    name: string,
    payload: unknown,
    meta: Partial<EventsMeta<Local | Remotes[number]>>,
  ): void {
    const fullMeta: EventsMeta<Local | Remotes[number]> = {
      environment: meta.environment ?? this.meta.environment,
      source: meta.source ?? this.meta.source,
      depth: meta.depth ?? 0,
      trace_id: meta.trace_id ?? crypto.randomUUID(),
      timestamp: meta.timestamp ?? Date.now(),
    }

    if (!this._checkDepth(name, fullMeta.depth, fullMeta.trace_id)) return

    this._emitLocal(name, payload, fullMeta)
  }

  /**
   * Internal emit implementation
   */
  private _emitLocal(
    name: string,
    payload: unknown,
    meta: EventsMeta<Local | Remotes[number]>,
  ): void {
    const segments = splitSegments(name)
    const context: EventsHandlerContext<Local | Remotes[number]> = {
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
    context: EventsHandlerContext<Local | Remotes[number]>,
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
    context: EventsHandlerContext<Local | Remotes[number]>,
    handler: EventsHandler<Local | Remotes[number]>,
  ): void {
    const errorMeta: EventsMeta<Local> = {
      environment: this.meta.environment,
      source: "events:error_handler",
      depth: context.meta.depth,
      trace_id: context.meta.trace_id,
      timestamp: Date.now(),
    }

    this._emitLocal(
      "events:error",
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
    context: EventsHandlerContext<Local | Remotes[number]>,
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
    handler: EventsHandler<Local | Remotes[number]>,
    once: boolean,
  ): EventsUnsubscribe {
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
    registry: Array<{ name: string }>
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

    const registry = Array.from(this.registry.entries()).map(([name]) => ({
      name,
    }))

    return {
      exact,
      wildcards,
      registry,
      environment: this.meta.environment,
    }
  }
}
