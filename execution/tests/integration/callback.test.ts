import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { serve } from 'bun';

const EXECUTION_URL = 'http://localhost:8081';

describe('Callback Tests', () => {
  let mockServer: ReturnType<typeof serve>;
  let receivedCallbacks: any[] = [];
  let receivedChunks: any[] = [];
  const MOCK_PORT = 9999;

  beforeAll(() => {
    // Start mock callback server
    mockServer = serve({
      port: MOCK_PORT,
      async fetch(req) {
        const url = new URL(req.url);
        const body = await req.json();

        if (url.pathname === '/callback') {
          receivedCallbacks.push(body);
          return new Response('OK');
        }

        if (url.pathname === '/executor/chunk/callback') {
          receivedChunks.push(body);
          return new Response('OK');
        }

        return new Response('Not found', { status: 404 });
      },
    });

    console.log(`✓ Mock callback server started on port ${MOCK_PORT}`);
  });

  afterAll(() => {
    mockServer.stop();
    console.log('✓ Mock callback server stopped');
  });

  beforeEach(() => {
    receivedCallbacks = [];
    receivedChunks = [];
  });

  it('should receive callback after task completion', async () => {
    const taskId = `callback-test-${Date.now()}`;

    // Submit task
    const response = await fetch(`${EXECUTION_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: taskId,
        command: "Say 'test completed'",
        callback_url: `http://host.docker.internal:${MOCK_PORT}/callback`,
        model: {
          provider: 'kimi-for-coding',
          modelId: 'kimi-k2-thinking',
          apiKey: process.env.KIMI_API_KEY || '',
        },
      }),
    });

    expect(response.status).toBe(200);

    // Wait for callback (up to 30 seconds)
    let retries = 0;
    while (receivedCallbacks.length === 0 && retries < 30) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      retries++;
    }

    expect(receivedCallbacks.length).toBeGreaterThan(0);

    const callback = receivedCallbacks[0];
    expect(callback.task_id).toBe(taskId);
    expect(callback.status).toBeDefined();
    expect(callback.result).toBeDefined();
  }, 35000);

  it('should receive chunks during task execution', async () => {
    const taskId = `chunk-test-${Date.now()}`;

    // Submit task with long response
    const response = await fetch(`${EXECUTION_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: taskId,
        command: 'Write a 5 sentence story about a cat',
        callback_url: `http://host.docker.internal:${MOCK_PORT}/callback`,
        model: {
          provider: 'kimi-for-coding',
          modelId: 'kimi-k2-thinking',
          apiKey: process.env.KIMI_API_KEY || '',
        },
      }),
    });

    expect(response.status).toBe(200);

    // Wait for chunks and callback
    let retries = 0;
    while (receivedCallbacks.length === 0 && retries < 30) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      retries++;
    }

    // Should receive either chunks or callback
    expect(receivedCallbacks.length + receivedChunks.length).toBeGreaterThan(0);
  }, 35000);
});
