import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

const EXECUTION_URL = 'http://localhost:8081';

describe('Docker Execution Service', () => {
  beforeAll(async () => {
    // Wait for service to be ready
    let retries = 0;
    while (retries < 30) {
      try {
        const response = await fetch(`${EXECUTION_URL}/health`);
        if (response.ok) {
          console.log('✓ Execution service is ready');
          return;
        }
      } catch {
        // Service not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      retries++;
    }
    throw new Error('Execution service failed to start');
  });

  it('GET /health should return ok', async () => {
    const response = await fetch(`${EXECUTION_URL}/health`);
    expect(response.status).toBe(200);

    const data = (await response.json()) as { status: string };
    expect(data.status).toBe('ok');
  });

  it('POST /execute should accept valid task', async () => {
    const response = await fetch(`${EXECUTION_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: 'test-123',
        command: 'Say hello',
        callback_url: 'http://localhost:9999/callback',
      }),
    });

    expect(response.status).toBe(200);

    const data = (await response.json()) as { success: boolean; status: string; task_id: string };
    expect(data.success).toBe(true);
    expect(data.status).toBe('accepted');
    expect(data.task_id).toBe('test-123');
  });

  it('POST /execute should reject missing task_id', async () => {
    const response = await fetch(`${EXECUTION_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: 'Say hello',
        callback_url: 'http://localhost:9999/callback',
      }),
    });

    expect(response.status).toBe(422);
  });

  it('POST /execute should reject missing command', async () => {
    const response = await fetch(`${EXECUTION_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: 'test-123',
        callback_url: 'http://localhost:9999/callback',
      }),
    });

    expect(response.status).toBe(422);
  });

  it('POST /execute should reject missing callback_url', async () => {
    const response = await fetch(`${EXECUTION_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: 'test-123',
        command: 'Say hello',
      }),
    });

    expect(response.status).toBe(422);
  });
});
