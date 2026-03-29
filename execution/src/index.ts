import { Elysia, t } from 'elysia';
import { executeTask } from './services/worker.js';
import { sendCallback } from './services/callback.js';
import { validateTaskInput } from './utils/validation.js';
import { CONFIG } from './config.js';

// Track active tasks for graceful shutdown
const activeTasks = new Set<string>();
let isShuttingDown = false;

const PORT = parseInt(process.env.PORT || String(CONFIG.DEFAULT_PORT));
const HOST = process.env.HOST || '0.0.0.0';

const app = new Elysia()
  .post(
    '/execute',
    async ({ body }) => {
      const { task_id, working_dir, command, callback_url, model, role_prompt } = body;

      // Validate input
      const validation = validateTaskInput({ task_id, command, callback_url, working_dir });
      if (!validation.valid) {
        return {
          success: false,
          status: 'rejected',
          error: validation.error,
        };
      }

      // Check if shutting down
      if (isShuttingDown) {
        return {
          success: false,
          status: 'rejected',
          error: 'Server is shutting down',
        };
      }

      console.log(`[Executor] Received task ${task_id}:`, command.substring(0, 100));

      // Track active task
      activeTasks.add(task_id);

      // Execute task asynchronously
      executeTask({
        task_id,
        working_dir: working_dir || CONFIG.DEFAULT_WORKING_DIR,
        command,
        callback_url,
        model,
        role_prompt,
      })
        .then((result) => {
          console.log(`[Executor] Task ${task_id} completed, sending callback`);
          sendCallback(callback_url, task_id, result);
        })
        .catch((error) => {
          console.error(`[Executor] Task ${task_id} failed:`, error);
          sendCallback(callback_url, task_id, {
            success: false,
            error: String(error),
          });
        })
        .finally(() => {
          activeTasks.delete(task_id);
        });

      return {
        success: true,
        status: 'accepted',
        task_id,
        model: model
          ? {
              provider: model.provider,
              modelId: model.modelId,
            }
          : {
              provider: 'default',
              modelId: 'default',
            },
      };
    },
    {
      body: t.Object({
        task_id: t.String(),
        command: t.String(),
        callback_url: t.String(),
        working_dir: t.Optional(t.String()),
        model: t.Optional(
          t.Object({
            provider: t.String(),
            modelId: t.String(),
            apiKey: t.String(),
          })
        ),
        role_prompt: t.Optional(t.String()),
      }),
    }
  )
  .get('/health', () => ({ status: 'ok' }))
  .listen({ port: PORT, hostname: HOST });

console.log(`[Executor] Ready for tasks on ${HOST}:${PORT}`);

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`[Executor] ${signal} received, shutting down gracefully...`);
  isShuttingDown = true;

  // Stop accepting new connections
  app.stop();

  // Wait for active tasks to complete (with timeout)
  if (activeTasks.size > 0) {
    console.log(`[Executor] Waiting for ${activeTasks.size} active tasks to complete...`);

    const waitTimeout = 30000; // 30 seconds
    const checkInterval = 1000; // 1 second
    const startTime = Date.now();

    const waitForTasks = async () => {
      while (activeTasks.size > 0 && Date.now() - startTime < waitTimeout) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
        console.log(`[Executor] Remaining tasks: ${activeTasks.size}`);
      }
    };

    await waitForTasks();

    if (activeTasks.size > 0) {
      console.log(`[Executor] Timeout reached, ${activeTasks.size} tasks still active`);
    } else {
      console.log('[Executor] All tasks completed');
    }
  }

  console.log('[Executor] Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
