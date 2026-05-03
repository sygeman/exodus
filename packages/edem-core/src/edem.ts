import { z } from "zod"

// ── Zod helpers ───────────────────────────────────────────────────────────────

type AnyZod = z.ZodTypeAny

// ── Procedure descriptors ─────────────────────────────────────────────────────

type ProcDesc =
  | { kind: "query"; input: AnyZod; output: AnyZod }
  | { kind: "mutation"; input: AnyZod; output: AnyZod }
  | { kind: "subscription"; output: AnyZod }

type ProcMap = Record<string, ProcDesc>

// ── Public API types ──────────────────────────────────────────────────────────

type ProcAPI<P> = P extends {
  kind: "query" | "mutation"
  input: infer TIn extends AnyZod
  output: infer TOut extends AnyZod
}
  ? (input: z.infer<TIn>) => Promise<z.infer<TOut>>
  : P extends { kind: "subscription"; output: infer TOut extends AnyZod }
    ? (handler: (args: { event: z.infer<TOut> }) => Promise<void> | void) => void
    : never

type ModuleAPI<TProcs extends ProcMap> = { [K in keyof TProcs]: ProcAPI<TProcs[K]> }

// ── Emit type ─────────────────────────────────────────────────────────────────

type EmitFromProcs<TProcs extends ProcMap> = {
  [K in keyof TProcs as TProcs[K] extends { kind: "subscription" } ? K : never]: TProcs[K] extends {
    kind: "subscription"
    output: infer TOut extends AnyZod
  }
    ? (event: z.infer<TOut>) => Promise<void>
    : never
}

// ── Def types ─────────────────────────────────────────────────────────────────

interface QueryDef<TIn extends AnyZod, TOut extends AnyZod, TCtx> {
  input: TIn
  output: TOut
  resolve: (args: { input: z.infer<TIn>; ctx: TCtx }) => Promise<z.infer<TOut>>
}

interface MutationDef<TIn extends AnyZod, TOut extends AnyZod, TCtx, TEmit> {
  input: TIn
  output: TOut
  resolve: (args: { input: z.infer<TIn>; ctx: TCtx; emit: TEmit }) => Promise<z.infer<TOut>>
}

interface SubscriptionDef<TOut extends AnyZod> {
  output: TOut
}

// ── EdemConfig ────────────────────────────────────────────────────────────────

interface EdemConfig {
  appData?: string
}

// ── ModuleBuilder ─────────────────────────────────────────────────────────────

export interface ModuleBuilder<TCtx, TProcs extends ProcMap> {
  context<C>(fn: (config: EdemConfig) => Promise<C>): ModuleBuilder<C, TProcs>

  subscription<TName extends string, TOut extends AnyZod>(
    name: TName,
    def: SubscriptionDef<TOut>,
  ): ModuleBuilder<TCtx, TProcs & Record<TName, { kind: "subscription"; output: TOut }>>

  mutation<TName extends string, TIn extends AnyZod, TOut extends AnyZod>(
    name: TName,
    def: MutationDef<TIn, TOut, TCtx, EmitFromProcs<TProcs>>,
  ): ModuleBuilder<TCtx, TProcs & Record<TName, { kind: "mutation"; input: TIn; output: TOut }>>

  query<TName extends string, TIn extends AnyZod, TOut extends AnyZod>(
    name: TName,
    def: QueryDef<TIn, TOut, TCtx>,
  ): ModuleBuilder<TCtx, TProcs & Record<TName, { kind: "query"; input: TIn; output: TOut }>>
}

// ── Runtime types ─────────────────────────────────────────────────────────────

type RuntimeHandler = (args: { event: unknown }) => Promise<void> | void

interface RuntimeProc {
  kind: "query" | "mutation" | "subscription"
  inputSchema?: AnyZod
  resolve?: (args: {
    input: unknown
    ctx: unknown
    emit: Record<string, (event: unknown) => Promise<void>>
  }) => Promise<unknown>
}

// ── EdemWorker ────────────────────────────────────────────────────────────────

export interface EdemWorker {
  request(name: string, input: unknown): Promise<unknown>
  emit(name: string, event: unknown): Promise<void>
  subscribe(name: string, handler: (event: unknown) => Promise<void> | void): void
}

export interface EdemWorkerContext {
  name: string
  procs: Map<string, RuntimeProc>
  subHandlers: Map<string, ((event: unknown) => void)[]>
  getCtx: () => Promise<unknown>
}

export type EdemWorkerFactory = (ctx: EdemWorkerContext) => EdemWorker

export function createLocalEdemWorker(ctx: EdemWorkerContext): EdemWorker {
  const makeEmit = (): Record<string, (event: unknown) => Promise<void>> => {
    const emit: Record<string, (event: unknown) => Promise<void>> = {}
    for (const [subName, handlers] of ctx.subHandlers.entries()) {
      emit[subName] = async (event: unknown) => {
        for (const h of handlers) await h(event)
      }
    }
    return emit
  }

  return {
    async request(name: string, input: unknown): Promise<unknown> {
      const proc = ctx.procs.get(name)
      if (!proc || proc.kind === "subscription") {
        throw new Error(`[edem] Unknown procedure "${name}" in module "${ctx.name}"`)
      }

      if (proc.inputSchema) {
        const result = proc.inputSchema.safeParse(input)
        if (!result.success) {
          throw new Error(`[edem] Invalid input for ${name}: ${result.error.message}`)
        }
        input = result.data
      }

      const context = await ctx.getCtx()
      return proc.resolve!({ input, ctx: context, emit: makeEmit() })
    },

    async emit(name: string, event: unknown): Promise<void> {
      const handlers = ctx.subHandlers.get(name)
      if (!handlers) return
      for (const h of handlers) await h(event)
    },

    subscribe(name: string, handler: (event: unknown) => Promise<void> | void): void {
      if (!ctx.subHandlers.has(name)) {
        ctx.subHandlers.set(name, [])
      }
      ctx.subHandlers.get(name)!.push(handler)
    },
  }
}

// ── ModuleBuilderImpl ─────────────────────────────────────────────────────────

class ModuleBuilderImpl {
  private _contextFn: (() => Promise<unknown>) | null = null
  private _config: EdemConfig = {}
  private readonly _subHandlers: Map<string, ((event: unknown) => void)[]> = new Map()
  private readonly _runtimeProcs: Map<string, RuntimeProc> = new Map()

  getContextFn() {
    return this._contextFn
  }

  getSubHandlers() {
    return this._subHandlers
  }

  getRuntimeProcs() {
    return this._runtimeProcs
  }

  setConfig(config: EdemConfig) {
    this._config = config
  }

  context(fn: (config: EdemConfig) => Promise<unknown>): this {
    const config = this._config
    this._contextFn = () => fn(config)
    return this
  }

  subscription(name: string, _def: SubscriptionDef<AnyZod>): this {
    this._runtimeProcs.set(name, { kind: "subscription" })
    this._subHandlers.set(name, [])
    return this
  }

  mutation(name: string, def: MutationDef<AnyZod, AnyZod, unknown, unknown>): this {
    this._runtimeProcs.set(name, {
      kind: "mutation",
      inputSchema: def.input,
      resolve: def.resolve as RuntimeProc["resolve"],
    })
    return this
  }

  query(name: string, def: QueryDef<AnyZod, AnyZod, unknown>): this {
    this._runtimeProcs.set(name, {
      kind: "query",
      inputSchema: def.input,
      resolve: def.resolve as RuntimeProc["resolve"],
    })
    return this
  }
}

// ── EdemModuleFn ──────────────────────────────────────────────────────────────

export interface EdemModuleFn<TName extends string, TProcs extends ProcMap> {
  _name: TName
  _procs: TProcs
  _register: (builder: ModuleBuilderImpl) => void
  _react: ((edem: unknown) => void) | null
}

// ── createEdemModule ──────────────────────────────────────────────────────────

export function getModuleSubscriptions(mod: EdemModuleFn<string, ProcMap>): string[] {
  return Object.entries(mod._procs)
    .filter(([, desc]) => desc.kind === "subscription")
    .map(([name]) => name)
}

export function createEdemModule<
  TName extends string,
  TProcs extends ProcMap,
  TEdem = Record<string, Record<string, Function>>,
>(
  name: TName,
  register: (module: ModuleBuilder<{}, {}>) => ModuleBuilder<Record<string, unknown>, TProcs>,
  react?: (edem: TEdem) => void,
): EdemModuleFn<TName, TProcs> {
  return {
    _name: name,
    _procs: {} as TProcs,
    _register: (builder: ModuleBuilderImpl) => {
      register(builder as unknown as ModuleBuilder<{}, {}>)
    },
    _react: react ? (edem: unknown) => react(edem as TEdem) : null,
  }
}

// ── Helper: build proxy for a module ─────────────────────────────────────────

function buildProxy(
  moduleName: string,
  builder: ModuleBuilderImpl,
  workerFactory: EdemWorkerFactory,
): Record<string, unknown> {
  const proxy: Record<string, unknown> = {}
  const runtimeProcs = builder.getRuntimeProcs()
  const subHandlers = builder.getSubHandlers()
  const contextFn = builder.getContextFn()

  let cachedCtx: unknown = undefined
  let ctxInitialized = false
  let ctxPromise: Promise<unknown> | null = null

  const getCtx = async (): Promise<unknown> => {
    if (ctxInitialized) return cachedCtx
    if (!ctxPromise) {
      ctxPromise = contextFn ? contextFn() : Promise.resolve({})
    }
    cachedCtx = await ctxPromise
    ctxInitialized = true
    return cachedCtx
  }

  const worker = workerFactory({
    name: moduleName,
    procs: runtimeProcs,
    subHandlers,
    getCtx,
  })

  for (const [procName, proc] of runtimeProcs.entries()) {
    if (proc.kind === "query" || proc.kind === "mutation") {
      proxy[procName] = (input: unknown): Promise<unknown> => worker.request(procName, input)
    } else {
      proxy[procName] = (handler: RuntimeHandler): void => {
        worker.subscribe(procName, (event: unknown) => handler({ event }))
      }
    }
  }

  return proxy
}

// ── createEdem ────────────────────────────────────────────────────────────────

export class EdemError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = "EdemError"
  }
}

type MergeModules<T extends EdemModuleFn<string, ProcMap>[]> = {
  [K in T[number] as K["_name"]]: ModuleAPI<K["_procs"]>
}

export function createEdem<const TModules extends EdemModuleFn<string, ProcMap>[]>(
  modules: [...TModules],
  config?: EdemConfig,
  workerFactory: EdemWorkerFactory = createLocalEdemWorker,
): MergeModules<TModules> {
  const edem: Record<string, Record<string, unknown>> = {}

  for (const mod of modules) {
    try {
      const builder = new ModuleBuilderImpl()
      builder.setConfig(config ?? {})
      mod._register(builder)
      edem[mod._name] = buildProxy(mod._name, builder, workerFactory)
    } catch (cause) {
      throw new EdemError(`Failed to register module "${mod._name}"`, cause)
    }
  }

  for (const mod of modules) {
    if (mod._react) {
      try {
        mod._react(edem)
      } catch (cause) {
        throw new EdemError(`Failed to initialize reactions for module "${mod._name}"`, cause)
      }
    }
  }

  return edem as MergeModules<TModules>
}

// ── createEdemProxy ─────────────────────────────────────────────────────────

export type InferModuleAPI<T> =
  T extends EdemModuleFn<string, infer TProcs> ? ModuleAPI<TProcs> : never

function buildModuleProxy(worker: EdemWorker): Record<string, unknown> {
  return new Proxy(
    {},
    {
      get(_target, procName: string) {
        return (input: unknown): Promise<unknown> => worker.request(procName, input)
      },
    },
  )
}

export function createEdemProxy<
  T extends Record<string, Record<string, (...args: never[]) => unknown>>,
>(workerFactory: EdemWorkerFactory): T {
  const moduleWorkers = new Map<string, EdemWorker>()

  const getWorker = (moduleName: string): EdemWorker => {
    if (!moduleWorkers.has(moduleName)) {
      const worker = workerFactory({
        name: moduleName,
        procs: new Map(),
        subHandlers: new Map(),
        getCtx: async () => ({}),
      })
      moduleWorkers.set(moduleName, worker)
    }
    return moduleWorkers.get(moduleName)!
  }

  return new Proxy({} as T, {
    get(_target, moduleName: string) {
      return buildModuleProxy(getWorker(moduleName))
    },
  })
}
