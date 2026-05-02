// Webview-side edem: calls go through RPC to bun where the real edem lives.
// Will be replaced with edem-electrobun/webview proxy once RPC wiring is done.
export const edem = {} as Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>
