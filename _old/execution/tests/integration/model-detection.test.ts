import { describe, it, expect, beforeAll } from 'bun:test';

const EXECUTION_URL = 'http://localhost:8081';

describe('Model Detection Tests', () => {
  beforeAll(async () => {
    // Wait for service to be ready
    let retries = 0;
    while (retries < 30) {
      try {
        const response = await fetch(`${EXECUTION_URL}/health`);
        if (response.ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 1000));
      retries++;
    }
    throw new Error('Execution service failed to start');
  });

  it('should use specified model in task execution', async () => {
    const taskId = `model-test-${Date.now()}`;

    // This test requires KIMI_API_KEY to be set
    if (!process.env.KIMI_API_KEY) {
      console.log('⚠ Skipping test: KIMI_API_KEY not set');
      return;
    }

    const response = await fetch(`${EXECUTION_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: taskId,
        command: 'What is your model name? Reply with just the model name.',
        callback_url: 'http://host.docker.internal:9999/callback',
        model: {
          provider: 'kimi-for-coding',
          modelId: 'kimi-k2-thinking',
          apiKey: process.env.KIMI_API_KEY,
        },
      }),
    });

    expect(response.status).toBe(200);

    const data = (await response.json()) as { success: boolean; status: string };
    expect(data.success).toBe(true);
    expect(data.status).toBe('accepted');

    // Note: To fully verify model detection, we need to:
    // 1. Check the callback response
    // 2. Or add model info to the accepted response
    // This is a basic test that the request is accepted
  });

  it('should accept task without model config (uses default)', async () => {
    const taskId = `default-model-test-${Date.now()}`;

    const response = await fetch(`${EXECUTION_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: taskId,
        command: 'Say hello',
        callback_url: 'http://host.docker.internal:9999/callback',
      }),
    });

    expect(response.status).toBe(200);

    const data = (await response.json()) as { success: boolean; status: string };
    expect(data.success).toBe(true);
    expect(data.status).toBe('accepted');
  });
});
