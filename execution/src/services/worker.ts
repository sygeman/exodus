import { OpenCodeExecutor } from './opencode.js';
import { sendChunk } from './callback.js';
import { CONFIG } from '../config.js';

interface TaskParams {
  task_id: string;
  working_dir: string;
  command: string;
  callback_url: string;
  model?: {
    provider: string;
    modelId: string;
    apiKey: string;
  };
  role_prompt?: string;
}

interface TaskResult {
  success: boolean;
  task_id: string;
  response: string;
  result?: string;
  error?: string;
}

async function getOpenCode(
  working_dir: string,
  modelConfig?: { provider: string; modelId: string; apiKey: string }
): Promise<OpenCodeExecutor> {
  console.log(`[Worker] Creating new OpenCode instance for ${working_dir}`);
  const openCode = new OpenCodeExecutor();

  try {
    await openCode.connect(working_dir, modelConfig);

    // Wait for session to be ready
    await new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const checkReady = () => {
        if (openCode.isReady()) {
          resolve();
          return;
        }
        if (++attempts >= CONFIG.MAX_CONNECTION_ATTEMPTS) {
          reject(new Error('Failed to initialize OpenCode session'));
          return;
        }
        setTimeout(checkReady, CONFIG.CONNECTION_RETRY_INTERVAL);
      };
      checkReady();
    });

    return openCode;
  } catch (error) {
    // Cleanup on connection error
    await openCode.disconnect().catch(() => {});
    throw error;
  }
}

export async function executeTask(params: TaskParams): Promise<TaskResult> {
  const { task_id, working_dir, command, callback_url, model, role_prompt } = params;

  console.log(`[Worker] Executing task ${task_id}:`, command.substring(0, 100));
  console.log(`[Worker] Working directory: ${working_dir}`);

  if (model) {
    console.log(`[Worker] Using model: ${model.provider}/${model.modelId}`);
  }

  let oc: OpenCodeExecutor | null = null;

  try {
    // Combine role prompt with command
    let fullCommand = command;
    if (role_prompt?.trim()) {
      fullCommand = `<role>\n${role_prompt.trim()}\n</role>\n\n<task>\n${command}\n</task>`;
      console.log(`[Worker] Using role prompt: ${role_prompt.substring(0, 50)}...`);
    }

    // Use OpenCode AI via ACP protocol
    oc = await getOpenCode(working_dir, model);

    // Set up chunk streaming
    oc.setOnChunk((chunk: string) => {
      console.log(`[Worker] Chunk received for task ${task_id}:`, chunk.substring(0, 50));
      sendChunk(callback_url, task_id, chunk);
    });

    // Execute task
    const result = await oc.executeTask(fullCommand);

    console.log(`[Worker] Task ${task_id} completed successfully`);

    return {
      success: true,
      task_id,
      response: result.response,
      result: result.response,
    };
  } catch (error) {
    console.error(`[Worker] Task ${task_id} failed:`, error);

    return {
      success: false,
      task_id,
      response: `❌ Ошибка выполнения: ${error}`,
      error: String(error),
    };
  } finally {
    // Always cleanup resources
    if (oc) {
      await oc.disconnect().catch((err) => {
        console.error(`[Worker] Failed to disconnect OpenCode for task ${task_id}:`, err);
      });
    }
  }
}
