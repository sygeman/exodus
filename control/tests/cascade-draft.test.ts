import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { buildGraphFromYaml } from '../src/services/cascade';

const TEST_DIR = '/tmp/exodus-test-draft';

describe('buildGraphFromYaml - draft support', () => {
  beforeAll(async () => {
    await mkdir(join(TEST_DIR, 'exodus'), { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should load draft nodes from draft.yaml', async () => {
    // Создать draft.yaml
    const draftContent = `meta:
  level: L0
  type: draft
  id: exodus-draft
  status: draft
  created: "2025-01-01"

ideas:
  - id: ABCD1234
    type: goal
    text: "Test draft goal"
  - id: EFGH5678
    type: component
    text: "Test draft component"
    supports: [ABCD1234]
`;
    await writeFile(join(TEST_DIR, 'exodus', 'draft.yaml'), draftContent);

    // Создать минимальный exodus.yaml
    await writeFile(join(TEST_DIR, 'exodus.yaml'), 'vision: ./exodus/vision.yaml\n');

    // Создать пустой vision.yaml
    const visionContent = `meta:
  level: L0
  type: vision
  id: exodus-vision
  status: draft
  created: "2025-01-01"

ideas: []
`;
    await writeFile(join(TEST_DIR, 'exodus', 'vision.yaml'), visionContent);

    const graph = await buildGraphFromYaml(TEST_DIR, 'test');

    // Должны быть draft ноды
    const draftNodes = graph.nodes.filter(n => n.level === null);
    expect(draftNodes.length).toBe(2);

    const draftNodeIds = draftNodes.map(n => n.id);
    expect(draftNodeIds).toContain('ABCD1234');
    expect(draftNodeIds).toContain('EFGH5678');

    // Должна быть связь
    const draftEdges = graph.edges.filter(e =>
      e.source === 'EFGH5678' && e.target === 'ABCD1234'
    );
    expect(draftEdges.length).toBe(1);
    expect(draftEdges[0]!.type).toBe('supports');
  });

  it('should load only draft.yaml when no exodus.yaml exists', async () => {
    const emptyDir = join(TEST_DIR, 'empty-project');
    await mkdir(join(emptyDir, 'exodus'), { recursive: true });

    const draftContent = `meta:
  level: L0
  type: draft
  id: exodus-draft
  status: draft
  created: "2025-01-01"

ideas:
  - id: ONLY1
    type: goal
    text: "Only draft node"
`;
    await writeFile(join(emptyDir, 'exodus', 'draft.yaml'), draftContent);

    const graph = await buildGraphFromYaml(emptyDir, 'empty');

    expect(graph.nodes.length).toBe(1);
    expect(graph.nodes[0]!.id).toBe('ONLY1');
    expect(graph.nodes[0]!.level).toBeNull();
    expect(graph.nodes[0]!.status).toBe('draft');
  });
});
