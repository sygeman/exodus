import { describe, it, expect } from 'bun:test';
import { Elysia } from 'elysia';
import { cascadeRoutes } from '../src/routes/cascade';

describe('Cascade API', () => {
  const app = new Elysia().use(cascadeRoutes);

  describe('Request validation', () => {
    it('should reject add node with missing body', async () => {
      const response = await app.handle(
        new Request('http://localhost/projects/test/cascade/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: 'L0' }),
        })
      );
      expect(response.status).toBe(422);
    });

    it('should reject add node with empty text', async () => {
      const response = await app.handle(
        new Request('http://localhost/projects/test/cascade/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: 'L0',
            type: 'goal',
            text: '',
          }),
        })
      );
      expect(response.status).toBe(422);
    });

    it('should reject add edge with missing fields', async () => {
      const response = await app.handle(
        new Request('http://localhost/projects/test/cascade/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId: 'A' }),
        })
      );
      expect(response.status).toBe(422);
    });

    it('should reject add edge with invalid type', async () => {
      const response = await app.handle(
        new Request('http://localhost/projects/test/cascade/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: 'A',
            targetId: 'B',
            type: 'invalid_type',
          }),
        })
      );
      expect(response.status).toBe(422);
    });
  });
});
