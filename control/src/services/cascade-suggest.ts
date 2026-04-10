import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { projects } from '../db/schema';
import { buildGraphFromYaml } from './cascade';
import { MutableGraph, graphStore } from './cascade-mutation';

export interface SuggestionResult {
  text: string;
  level: string | null;
  type: string | null;
  edges: Array<{ targetId: string; type: string }>;
}

export interface SuggestRequest {
  nodeId: string;
  userInput?: string;
}

export interface SuggestResponse {
  success: boolean;
  data?: SuggestionResult;
  error?: string;
}

// Хранилище pending suggest задач
const pendingSuggests = new Map<string, {
  resolve: (result: string) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}>();

/**
 * Обработать callback от execution
 */
export function handleSuggestCallback(taskId: string, result: string) {
  const pending = pendingSuggests.get(taskId);
  if (pending) {
    pending.resolve(result);
    clearTimeout(pending.timeout);
    pendingSuggests.delete(taskId);
  }
}

/**
 * Собрать контекст из графа для LLM
 */
function buildContext(graph: MutableGraph, nodeId: string): string {
  const node = graph.getNode(nodeId);
  if (!node) return '';

  const allNodes = graph.getGraph().nodes;

  // Ноды по уровням
  const byLevel: Record<string, typeof allNodes> = {};
  allNodes.forEach(n => {
    const level = n.level || 'draft';
    if (!byLevel[level]) byLevel[level] = [];
    byLevel[level].push(n);
  });

  let context = `Текущая идея: "${node.text}"\n`;
  context += `Уровень: ${node.level || 'draft'}\n\n`;

  context += 'Структура проекта:\n';
  for (const [level, nodes] of Object.entries(byLevel)) {
    context += `\n${level}:\n`;
    nodes.forEach(n => {
      context += `  - [${n.id}] ${n.text}${n.type ? ` (${n.type})` : ''}\n`;
    });
  }

  return context;
}

/**
 * Сгенерировать промпт для LLM
 */
function buildPrompt(context: string, userInput?: string): string {
  let prompt = `Ты — suggester в системе ACSD. Твоя задача — предложить как развить идею в каскаде.

Контекст проекта:
${context}

Правила:
1. Предложи ОДИН вариант развития идеи
2. Определи подходящий уровень (L0-L4) на основе контекста
3. Определи тип (goal, non_goal, constraint, invariant, component, decision, principle)
4. Предложи связи с существующими нодами (implements, requires, part_of, supports, contradicts)
5. Уточни формулировку — сделай её конкретной и actionable
6. Если идея уже стабилизирована — предложи следующий шаг детализации
7. Отвечай ТОЛЬКО JSON, без дополнительного текста

Формат ответа — ТОЛЬКО JSON:
{
  "text": "уточнённый текст идеи",
  "level": "L0" | "L1" | "L2" | "L3" | "L4" | null,
  "type": "goal" | "non_goal" | "constraint" | "invariant" | "component" | "decision" | "principle" | null,
  "edges": [
    { "targetId": "ID_существующей_ноды", "type": "implements" | "requires" | "part_of" | "supports" | "contradicts" }
  ]
}`;

  if (userInput) {
    prompt += `\n\nЗапрос пользователя: ${userInput}`;
  }

  return prompt;
}

/**
 * Вызвать Execution для генерации предложения
 */
async function callExecution(prompt: string, projectId: string): Promise<string> {
  const executionUrl = process.env.EXECUTION_URL || 'http://execution:8081/execute';
  const callbackUrl = `${process.env.CONTROL_URL || 'http://control:8080'}/projects/${projectId}/cascade/callback`;

  const taskId = `suggest-${Date.now()}`;

  return new Promise((resolve, reject) => {
    // Установить таймаут
    const timeout = setTimeout(() => {
      pendingSuggests.delete(taskId);
      reject(new Error('Suggest timeout'));
    }, 60000); // 60 секунд

    // Зарегистрировать pending
    pendingSuggests.set(taskId, { resolve, reject, timeout });

    // Отправить задачу в execution
    fetch(executionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: taskId,
        command: prompt,
        callback_url: callbackUrl,
        role_prompt: `Отвечай ТОЛЬКО валидным JSON. Никакого дополнительного текста.`,
      }),
    }).catch(reject);
  });
}

/**
 * Предложить развитие идеи
 */
export async function suggest(
  projectId: string,
  request: SuggestRequest
): Promise<SuggestResponse> {
  try {
    // Загрузить проект
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      return { success: false, error: 'Project not found' };
    }

    // Загрузить граф: из кэша или из YAML
    let mutableGraph: MutableGraph;
    if (graphStore.has(projectId)) {
      mutableGraph = graphStore.get(projectId)!;
    } else {
      const graph = await buildGraphFromYaml(project[0]!.path, project[0]!.name);
      mutableGraph = new MutableGraph(graph);
    }

    // Собрать контекст
    const context = buildContext(mutableGraph, request.nodeId);
    if (!context) {
      return { success: false, error: 'Node not found' };
    }

    // Сгенерировать промпт
    const prompt = buildPrompt(context, request.userInput);

    // Вызвать Execution
    const response = await callExecution(prompt, projectId);

    // Распарсить ответ
    const suggestion: SuggestionResult = JSON.parse(response);

    return { success: true, data: suggestion };
  } catch (error) {
    return {
      success: false,
      error: `Suggest failed: ${error}`,
    };
  }
}
