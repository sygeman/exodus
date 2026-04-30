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

// ── ModuleBuilder ─────────────────────────────────────────────────────────────

export interface ModuleBuilder<TCtx, TProcs extends ProcMap> {
  context<C>(fn: () => Promise<C>): ModuleBuilder<C, TProcs>

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
  resolve?: (args: {
    input: unknown
    ctx: unknown
    emit: Record<string, (event: unknown) => Promise<void>>
  }) => Promise<unknown>
}

// ── ModuleBuilderImpl ─────────────────────────────────────────────────────────

class ModuleBuilderImpl {
  private _contextFn: (() => Promise<unknown>) | null = null
  private readonly _subHandlers: Map<string, RuntimeHandler[]> = new Map()
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

  context(fn: () => Promise<unknown>): this {
    this._contextFn = fn
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
      resolve: def.resolve as RuntimeProc["resolve"],
    })
    return this
  }

  query(name: string, def: QueryDef<AnyZod, AnyZod, unknown>): this {
    this._runtimeProcs.set(name, {
      kind: "query",
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

function buildProxy(builder: ModuleBuilderImpl): Record<string, unknown> {
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

  const makeEmit = (): Record<string, (event: unknown) => Promise<void>> => {
    const emit: Record<string, (event: unknown) => Promise<void>> = {}
    for (const [subName, handlers] of subHandlers.entries()) {
      emit[subName] = async (event: unknown) => {
        for (const h of handlers) await h({ event })
      }
    }
    return emit
  }

  for (const [procName, proc] of runtimeProcs.entries()) {
    if (proc.kind === "query" || proc.kind === "mutation") {
      const resolve = proc.resolve!
      proxy[procName] = async (input: unknown): Promise<unknown> => {
        const ctx = await getCtx()
        return resolve({ input, ctx, emit: makeEmit() })
      }
    } else {
      proxy[procName] = (handler: RuntimeHandler): void => {
        subHandlers.get(procName)!.push(handler)
      }
    }
  }

  return proxy
}

// ── createEdem ────────────────────────────────────────────────────────────────

type MergeModules<T extends EdemModuleFn<string, ProcMap>[]> = {
  [K in T[number] as K["_name"]]: ModuleAPI<K["_procs"]>
}

export function createEdem<const TModules extends EdemModuleFn<string, ProcMap>[]>(
  modules: [...TModules],
): MergeModules<TModules> {
  const edem: Record<string, Record<string, unknown>> = {}

  for (const mod of modules) {
    const builder = new ModuleBuilderImpl()
    mod._register(builder)
    edem[mod._name] = buildProxy(builder)
  }

  for (const mod of modules) {
    if (mod._react) mod._react(edem)
  }

  return edem as MergeModules<TModules>
}
