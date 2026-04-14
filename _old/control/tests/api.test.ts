import { describe, it, expect } from 'bun:test';
import { Elysia } from 'elysia';
import { projectsRoutes } from '../src/routes/projects';

describe('Control API', () => {
  const app = new Elysia().use(projectsRoutes);

  describe('Projects API', () => {
    it('should list projects', async () => {
      const response = await app.handle(new Request('http://localhost/projects'));
      const body = await response.json() as { success: boolean; data: unknown[] };
      
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should validate project name', async () => {
      const response = await app.handle(
        new Request('http://localhost/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '' }),
        })
      );
      
      expect(response.status).toBe(400);
    });
  });
});