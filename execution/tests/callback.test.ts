import { describe, it, expect } from 'bun:test';
import { sendCallback, sendChunk } from '../src/services/callback.js';

type FetchFn = typeof fetch;

interface CallbackPayload {
  task_id: string;
  status: string;
  result?: string;
  error?: string | null;
  exit_code: number;
}

interface ChunkPayload {
  task_id: string;
  chunk: string;
  chunk_type: string;
}

describe('Callback Service', () => {
  it('sendCallback should send POST request with correct payload', async () => {
    let receivedPayload: CallbackPayload | undefined;

    // Mock fetch
    const originalFetch = global.fetch;
    global.fetch = (async (_url: string, options: any) => {
      receivedPayload = JSON.parse(options.body) as CallbackPayload;
      return new Response(null, { status: 200 });
    }) as FetchFn;

    await sendCallback('http://test/callback', 'task-123', {
      success: true,
      response: 'test result',
    });

    expect(receivedPayload).toBeDefined();
    expect(receivedPayload!.task_id).toBe('task-123');
    expect(receivedPayload!.status).toBe('completed');
    expect(receivedPayload!.result).toBe('test result');
    expect(receivedPayload!.error).toBeNull();
    expect(receivedPayload!.exit_code).toBe(0);

    global.fetch = originalFetch;
  });

  it('sendCallback should handle failed tasks', async () => {
    let receivedPayload: CallbackPayload | undefined;

    const originalFetch = global.fetch;
    global.fetch = (async (_url: string, options: any) => {
      receivedPayload = JSON.parse(options.body) as CallbackPayload;
      return new Response(null, { status: 200 });
    }) as FetchFn;

    await sendCallback('http://test/callback', 'task-456', {
      success: false,
      error: 'Something went wrong',
    });

    expect(receivedPayload).toBeDefined();
    expect(receivedPayload!.status).toBe('failed');
    expect(receivedPayload!.exit_code).toBe(1);
    expect(receivedPayload!.error).toBe('Something went wrong');

    global.fetch = originalFetch;
  });

  it('sendChunk should send chunk to correct URL', async () => {
    let receivedUrl = '';
    let receivedPayload: ChunkPayload | undefined;

    const originalFetch = global.fetch;
    global.fetch = (async (url: string, options: any) => {
      receivedUrl = url;
      receivedPayload = JSON.parse(options.body) as ChunkPayload;
      return new Response(null, { status: 200 });
    }) as FetchFn;

    await sendChunk('http://test/executor/callback', 'task-789', 'chunk data');

    expect(receivedUrl).toBe('http://test/executor/callback/chunk');
    expect(receivedPayload).toBeDefined();
    expect(receivedPayload!.chunk).toBe('chunk data');
    expect(receivedPayload!.chunk_type).toBe('text');

    global.fetch = originalFetch;
  });
});
