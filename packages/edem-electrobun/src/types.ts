export interface EdemRequestMsg {
  type: "request"
  module: string
  proc: string
  input: unknown
  id: string
}

export interface EdemResponseMsg {
  type: "response"
  id: string
  result?: unknown
  error?: string
}

export interface EdemEventMsg {
  type: "event"
  module: string
  name: string
  payload: unknown
}

export type EdemMsg = EdemRequestMsg | EdemResponseMsg | EdemEventMsg
