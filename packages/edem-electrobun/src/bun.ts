/**
 * Edem Electrobun — Bun-side integration.
 *
 * Creates a full Edem platform with Electrobun-specific data path.
 */

import { BrowserView } from "electrobun/bun"
import type { RPCSchema } from "electrobun"
import { createPlatform } from "@exodus/edem-platform"

export async function createEdemElectrobun() {
  const edem = createPlatform()

  // Setup RPC bridge between bun and webview
  const rpc = BrowserView.defineRPC<{
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
