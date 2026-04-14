import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { projects } from '../db/schema';
import { buildGraphFromYaml } from '../services/cascade';
import {
  MutableGraph,
  graphStore,
} from '../services/cascade-mutation';
import { serializeGraphToYaml } from '../services/cascade-serialize';
import { suggest, handleSuggestCallback } from '../services/cascade-suggest';

/**
 * Получить граф: из кэша (если есть мутации) или из YAML
 */
async function getGraph(projectId: string): Promise<
  | { ok: false; status: number; message: string }
  | { ok: true; project: typeof projects.$inferSelect; graph: MutableGraph }
> {
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (project.length === 0) {
    return { ok: false, status: 404, message: 'Project not found' };
  }

  const projectData = project[0]!;

  // Если есть кэш с мутациями — берём из него
  if (graphStore.has(projectId)) {
    return { ok: true, project: projectData, graph: graphStore.get(projectId)! };
  }

  // Иначе загружаем из YAML
  try {
    const graph = await buildGraphFromYaml(projectData.path, projectData.name);
    return { ok: true, project: projectData, graph: new MutableGraph(graph) };
  } catch {
    return { ok: true, project: projectData, graph: new MutableGraph() };
  }
}

/**
 * Получить граф для мутации: загружает из YAML или берёт кэш, сохраняет в кэш
 */
async function getGraphForMutation(projectId: string): Promise<
  | { ok: false; status: number; message: string }
  | { ok: true; project: typeof projects.$inferSelect; graph: MutableGraph }
> {
  const result = await getGraph(projectId);
  if (!result.ok) return result;

  // Сохраняем в кэш чтобы следующие мутации работали с тем же графом
  graphStore.set(projectId, result.graph);
  return result;
}

export const cascadeRoutes = new Elysia({ prefix: '/projects/:id/cascade' })
  // Получить текущее состояние графа
  .get('/graph', async ({ params, set }) => {
    const result = await getGraph(params.id);
    if (!result.ok) {
      set.status = result.status;
      return { success: false, error: result.message };
    }

    return {
      success: true,
      data: result.graph.getGraph(),
    };
  })

  // Предложить развитие идеи
  .post(
    '/suggest',
    async ({ params, body, set }) => {
      const result = await suggest(params.id, body);
      if (!result.success) {
        set.status = result.error === 'Project not found' ? 404 : 500;
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: result.data,
      };
    },
    {
      body: t.Object({
        nodeId: t.String({ description: 'ID ноды для анализа' }),
        userInput: t.Optional(t.String({ description: 'Запрос пользователя (опционально)' })),
      }),
    }
  )

  // Получить diff изменений
  .get('/diff', async ({ params, set }) => {
    const result = await getGraph(params.id);
    if (!result.ok) {
      set.status = result.status;
      return { success: false, error: result.message };
    }

    return {
      success: true,
      data: result.graph.getDiff(),
    };
  })

  // === NODES ===

  // Добавить ноду
  .post(
    '/nodes',
    async ({ params, body, set }) => {
      const result = await getGraphForMutation(params.id);
      if (!result.ok) {
        set.status = result.status;
        return { success: false, error: result.message };
      }

      const { graph } = result;

      // Проверить что target ноды существуют
      if (body.edges) {
        for (const edgeDef of body.edges) {
          if (!graph.getNode(edgeDef.targetId)) {
            set.status = 400;
            return {
              success: false,
              error: `target_node_not_found: ${edgeDef.targetId}`,
            };
          }
        }
      }

      // Проверить что parentId существует
      if (body.parentId && !graph.getNode(body.parentId)) {
        set.status = 400;
        return {
          success: false,
          error: `parent_node_not_found: ${body.parentId}`,
        };
      }

      try {
        const nodeId = MutableGraph.generateId();

        const node = graph.addNode(nodeId, {
          level: body.level,
          type: body.type ?? null,
          text: body.text,
          status: 'draft',
          parentId: body.parentId,
          edges: body.edges,
        });

        return {
          success: true,
          data: node,
        };
      } catch (error) {
        set.status = 500;
        return {
          success: false,
          error: `Failed to add node: ${error}`,
        };
      }
    },
    {
      body: t.Object({
        level: t.Union(
          [
            t.Literal('L0'),
            t.Literal('L1'),
            t.Literal('L2'),
            t.Literal('L3'),
            t.Literal('L4'),
            t.Null(),
          ],
          { description: 'Уровень каскада или null для draft' }
        ),
        type: t.Optional(
          t.Enum(
            {
              goal: 'goal',
              non_goal: 'non_goal',
              constraint: 'constraint',
              invariant: 'invariant',
              component: 'component',
              decision: 'decision',
              principle: 'principle',
            },
            { description: 'Тип идеи (по умолчанию goal для draft)' }
          )
        ),
        text: t.String({ minLength: 1, description: 'Текст идеи' }),
        parentId: t.Optional(
          t.String({ description: 'ID родительской ноды для implements связи' })
        ),
        edges: t.Optional(
          t.Array(
            t.Object({
              targetId: t.String(),
              type: t.Enum({
                implements: 'implements',
                requires: 'requires',
                part_of: 'part_of',
                supports: 'supports',
                contradicts: 'contradicts',
              }),
            }),
            { description: 'Связи для новой ноды' }
          )
        ),
      }),
    }
  )

  // Удалить ноду
  .delete(
    '/nodes/:nodeId',
    async ({ params, set }) => {
      const result = await getGraphForMutation(params.id);
      if (!result.ok) {
        set.status = result.status;
        return { success: false, error: result.message };
      }

      try {
        const removed = result.graph.removeNode({
          nodeId: params.nodeId,
          removeConnectedEdges: true,
        });

        return {
          success: true,
          data: {
            removedNode: removed.removedNode,
            removedEdgesCount: removed.removedEdges.length,
          },
        };
      } catch (error) {
        set.status = 400;
        return {
          success: false,
          error: String(error),
        };
      }
    }
  )

  // === EDGES ===

  // Добавить связь
  .post(
    '/edges',
    async ({ params, body, set }) => {
      const result = await getGraphForMutation(params.id);
      if (!result.ok) {
        set.status = result.status;
        return { success: false, error: result.message };
      }

      try {
        const edge = result.graph.addEdge({
          sourceId: body.sourceId,
          targetId: body.targetId,
          type: body.type,
        });

        return {
          success: true,
          data: edge,
        };
      } catch (error) {
        set.status = 400;
        return {
          success: false,
          error: String(error),
        };
      }
    },
    {
      body: t.Object({
        sourceId: t.String({ description: 'ID ноды-источника' }),
        targetId: t.String({ description: 'ID ноды-цели' }),
        type: t.Enum(
          {
            implements: 'implements',
            requires: 'requires',
            part_of: 'part_of',
            supports: 'supports',
            contradicts: 'contradicts',
          },
          { description: 'Тип связи' }
        ),
      }),
    }
  )

  // Удалить связь
  .delete(
    '/edges/:edgeId',
    async ({ params, set }) => {
      const result = await getGraphForMutation(params.id);
      if (!result.ok) {
        set.status = result.status;
        return { success: false, error: result.message };
      }

      try {
        const edge = result.graph.removeEdge({
          edgeId: params.edgeId,
        });

        return {
          success: true,
          data: edge,
        };
      } catch (error) {
        set.status = 400;
        return {
          success: false,
          error: String(error),
        };
      }
    }
  )

  // === COMMIT ===

  // Закоммитить изменения в YAML
  .post('/commit', async ({ params, set }) => {
    const result = await getGraphForMutation(params.id);
    if (!result.ok) {
      set.status = result.status;
      return { success: false, error: result.message };
    }

    const { project, graph } = result;

    try {
      const serialized = await serializeGraphToYaml(
        graph.getGraph(),
        project.path
      );

      if (!serialized.success) {
        set.status = 500;
        return serialized;
      }

      graph.resetDiff();

      // Очищаем кэш — теперь YAML источник правды
      graphStore.remove(params.id);

      return {
        success: true,
        data: {
          filesWritten: serialized.filesWritten,
        },
      };
    } catch (error) {
      set.status = 500;
      return {
        success: false,
        error: `Failed to commit: ${error}`,
      };
    }
  })

  // Callback endpoint для execution
  .post('/callback', async ({ body, set }) => {
    const { task_id, result, error, status } = body;

    const isSuccess = status === 'completed';

    if (!isSuccess || error) {
      handleSuggestCallback(task_id, JSON.stringify({ error }));
      return { success: true };
    }

    if (!result) {
      set.status = 400;
      return { success: false, error: 'No result in callback' };
    }

    handleSuggestCallback(task_id, result);
    return { success: true };
  }, {
    body: t.Object({
      task_id: t.String(),
      status: t.String(),
      result: t.Optional(t.String()),
      error: t.Optional(t.String()),
      exit_code: t.Optional(t.Number()),
    }),
  });
