const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

export async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  label: string,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * 2 ** attempt
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  console.error(
    `[flows:${context}] Failed to ${label} after ${MAX_RETRIES + 1} attempts:`,
    lastError,
  )
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
