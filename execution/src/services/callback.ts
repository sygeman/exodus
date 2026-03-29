interface CallbackResult {
  success: boolean;
  response?: string;
  result?: string;
  error?: string;
}

const CALLBACK_MAX_RETRIES = 3;
const CALLBACK_RETRY_DELAY = 1000; // 1 second
const MAX_CHUNK_SIZE = 4096; // 4KB

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkString(str: string, maxSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += maxSize) {
    chunks.push(str.slice(i, i + maxSize));
  }
  return chunks;
}

export async function sendCallback(
  callback_url: string,
  task_id: string,
  result: CallbackResult
): Promise<boolean> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= CALLBACK_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(callback_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id,
          status: result.success ? 'completed' : 'failed',
          result: result.response || result.result || null,
          error: result.error || null,
          exit_code: result.success ? 0 : 1,
        }),
      });

      if (response.ok) {
        console.log(`[Executor] Callback sent successfully for task ${task_id}`);
        return true;
      } else {
        console.error(`[Executor] Callback failed for task ${task_id}: ${response.status}`);
        lastError = new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(
        `[Executor] Callback attempt ${attempt}/${CALLBACK_MAX_RETRIES} failed for task ${task_id}:`,
        error
      );
      lastError = error as Error;
    }

    if (attempt < CALLBACK_MAX_RETRIES) {
      const delay = CALLBACK_RETRY_DELAY * Math.pow(2, attempt - 1); // exponential backoff
      console.log(`[Executor] Retrying callback for task ${task_id} in ${delay}ms...`);
      await sleep(delay);
    }
  }

  console.error(`[Executor] All callback attempts failed for task ${task_id}:`, lastError);
  return false;
}

export async function sendChunk(
  callback_url: string,
  task_id: string,
  chunk: string
): Promise<boolean> {
  try {
    // Build chunk URL by appending /chunk to the path
    const url = new URL(callback_url);
    url.pathname = url.pathname.replace(/\/?$/, '/chunk');

    // Split large chunks into smaller pieces (≤4KB each)
    const chunks = chunkString(chunk, MAX_CHUNK_SIZE);

    for (const chunkPart of chunks) {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id,
          chunk: chunkPart,
          chunk_type: 'text',
        }),
      });

      if (!response.ok) {
        console.error(`[Worker] Failed to send chunk for task ${task_id}: ${response.status}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error(`[Worker] Failed to send chunk for task ${task_id}:`, error);
    return false;
  }
}
