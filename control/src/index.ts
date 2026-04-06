import { Elysia } from 'elysia';
import { projectsRoutes } from './routes/projects';
import { runMigrations } from './db/migrate';

const PORT = parseInt(process.env.PORT || '8080');
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  // Run migrations before starting server
  await runMigrations();

  const app = new Elysia()
    .get('/health', () => ({ status: 'ok', service: 'control' }))
    .use(projectsRoutes)
    .listen({ port: PORT, hostname: HOST });

  console.log(`[Control] Ready on ${HOST}:${PORT}`);
}

startServer().catch((error) => {
  console.error('[Control] Failed to start:', error);
  process.exit(1);
});
