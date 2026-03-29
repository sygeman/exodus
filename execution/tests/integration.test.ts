import { describe, it, expect } from 'bun:test';

describe('Integration Tests', () => {
  it('should validate environment variables', () => {
    const PORT = parseInt(process.env.PORT || '8081');
    expect(PORT).toBeGreaterThan(0);
    expect(PORT).toBeLessThan(65536);
  });

  it('should verify TypeScript compilation', async () => {
    // Check that all source files can be imported
    const { sendCallback } = await import('../src/services/callback.js');
    const { executeTask } = await import('../src/services/worker.js');
    const { OpenCodeExecutor } = await import('../src/services/opencode.js');

    expect(typeof sendCallback).toBe('function');
    expect(typeof executeTask).toBe('function');
    expect(typeof OpenCodeExecutor).toBe('function');
  });
});
