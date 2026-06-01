export {
  createEdem,
  createEdemModule,
  createLocalEdemWorker,
  createEdemProxy,
  getEdemProcedureCatalog,
  getModuleProcedures,
  getModuleSubscriptions,
  getProcedureCatalog,
  EDEM_INIT,
  awaitEdemInit,
} from "./edem"
export type {
  EdemWorker,
  EdemWorkerFactory,
  EdemWorkerContext,
  InferModuleAPI,
  EdemModuleFn,
  ModuleProcedureCatalog,
  ProcedureKind,
  ProcedureMetadata,
} from "./edem"
