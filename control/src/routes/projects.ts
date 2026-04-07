import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { projects } from '../db/schema';
import { gitService } from '../services/git';

const PROJECTS_BASE_PATH = process.env.PROJECTS_PATH || '/data/projects';

export const projectsRoutes = new Elysia({ prefix: '/projects' })
  // GET /projects - List all projects
  .get('/', async () => {
    const allProjects = await db.select().from(projects);
    return {
      success: true,
      data: allProjects,
    };
  })

  // GET /projects/:id - Get project by ID
  .get('/:id', async ({ params, set }) => {
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, params.id))
      .limit(1);

    if (project.length === 0) {
      set.status = 404;
      return {
        success: false,
        error: 'Project not found',
      };
    }

    return {
      success: true,
      data: project[0],
    };
  })

  // POST /projects - Create new project
  .post(
    '/',
    async ({ body, set }) => {
      const { name, gitUrl, initEmpty } = body;

      // Check if project with this name already exists
      const existing = await db
        .select()
        .from(projects)
        .where(eq(projects.name, name))
        .limit(1);

      if (existing.length > 0) {
        set.status = 409;
        return {
          success: false,
          error: 'Project with this name already exists',
        };
      }

      const projectPath = `${PROJECTS_BASE_PATH}/${name}`;

      try {
        // Initialize or clone git repository
        if (gitUrl) {
          await gitService.clone(gitUrl, projectPath);
        } else if (initEmpty) {
          await gitService.init(projectPath);
        }

        // Create project record in database
        const newProject = await db
          .insert(projects)
          .values({
            name,
            gitUrl: gitUrl || null,
            path: projectPath,
          })
          .returning();

        return {
          success: true,
          data: newProject[0],
        };
      } catch (error) {
        set.status = 500;
        return {
          success: false,
          error: `Failed to create project: ${error}`,
        };
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 255 }),
        gitUrl: t.Optional(t.String({ format: 'uri' })),
        initEmpty: t.Optional(t.Boolean()),
      }),
    }
  )

  // DELETE /projects/:id - Delete project
  .delete('/:id', async ({ params, set }) => {
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, params.id))
      .limit(1);

    if (project.length === 0) {
      set.status = 404;
      return {
        success: false,
        error: 'Project not found',
      };
    }

    // Soft delete - update status to archived
    await db
      .update(projects)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(projects.id, params.id));

    return {
      success: true,
      message: 'Project archived successfully',
    };
  })

  // POST /projects/:id/pull - Pull latest changes
  .post('/:id/pull', async ({ params, set }) => {
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, params.id))
      .limit(1);

    if (project.length === 0) {
      set.status = 404;
      return {
        success: false,
        error: 'Project not found',
      };
    }

    try {
      await gitService.pull(project[0].path);
      return {
        success: true,
        message: 'Pulled latest changes',
      };
    } catch (error) {
      set.status = 500;
      return {
        success: false,
        error: `Failed to pull: ${error}`,
      };
    }
  });
