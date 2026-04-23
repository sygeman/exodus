/**
 * Edem Electrobun — Webview-side adapter.
 *
 * Bridges Edem events between webview and bun process via Electrobun's Electroview RPC.
 */

import { Electroview } from "electrobun/view"
import type { RPCSchema } from "electrobun"
import { Edem } from "@exodus/edem-core"

export function createEdemWebview() {
  const edem = new Edem("webview")

  const rpc = Electroview.defineRPC<{
    bun: RPCSchema<{ messages: { emit: { name: string; payload: unknown } } }>
    webview: RPCSchema<{
      messages: { emit: { name: string; payload: unknown } }
    }>
  }>({
    handlers: {
      messages: {
        emit: (msg: { name: string; payload: unknown }) => {
          edem.emit(msg.name, msg.payload)
        },
      },
    },
  })

  return { edem, rpc }
}
