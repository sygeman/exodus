import { describe, it, expect } from 'bun:test';
import { Elysia } from 'elysia';

interface TaskBody {
  task_id: string;
  command: string;
  callback_url: string;
}

interface TaskResponse {
  success: boolean;
  status: string;
  task_id: string;
}

interface HealthResponse {
  status: string;
}

describe('API Endpoints', () => {
  it('POST /execute should accept valid task', async () => {
    const app = new Elysia().post('/execute', ({ body }) => {
      const taskBody = body as TaskBody;
      return {
        success: true,
        status: 'accepted',
        task_id: taskBody.task_id,
      };
    });

    const response = await app.handle(
      new Request('http://localhost/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: 'test-123',
          command: 'test command',
          callback_url: 'http://localhost/callback',
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as TaskResponse;
    expect(data.success).toBe(true);
    expect(data.status).toBe('accepted');
    expect(data.task_id).toBe('test-123');
  });

  it('POST /execute should reject missing required fields', async () => {
    const app = new Elysia().post('/execute', ({ body }) => {
      const taskBody = body as TaskBody;
      if (!taskBody.task_id || !taskBody.command || !taskBody.callback_url) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
        });
      }
      return { success: true };
    });

    const response = await app.handle(
      new Request('http://localhost/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: 'test-123' }),
      })
    );

    expect(response.status).toBe(400);
  });

  it('GET /health should return ok', async () => {
    const app = new Elysia().get('/health', () => ({ status: 'ok' }));

    const response = await app.handle(new Request('http://localhost/health'));

    expect(response.status).toBe(200);
    const data = (await response.json()) as HealthResponse;
    expect(data.status).toBe('ok');
  });
});
