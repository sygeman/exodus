import { Electroview } from "electrobun/view"
import type { RPCSchema } from "electrobun"
import { createWebviewEdemBridge } from "@exodus/edem-electrobun/webview"
import type { EdemMsg } from "@exodus/edem-electrobun/types"

const edemBridge = createWebviewEdemBridge()

const rpc = Electroview.defineRPC<{
  bun: RPCSchema<{
    messages: { edem: EdemMsg }
  }>
  webview: RPCSchema<{
    messages: { edem: EdemMsg }
  }>
}>({
  handlers: {
    messages: {
      edem: (msg: EdemMsg) => {
        edemBridge.handler(msg)
      },
    },
  },
})

edemBridge.attachBun(rpc.send.edem)

export { rpc, edemBridge }
