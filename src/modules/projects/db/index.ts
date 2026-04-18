import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"
import { join, dirname } from "path"
import { projects, ideas } from "./schema"
import { desc, eq } from "drizzle-orm"
import { mkdirSync } from "fs"
import { Utils } from "electrobun/bun"
import type { Project, Idea } from "../events"

function getDbPath(): string {
  if (process.env.PROJECTS_DB_PATH) return process.env.PROJECTS_DB_PATH

  try {
    return join(Utils.paths.userData, "projects.db")
  } catch {
    return join(Utils.paths.home, ".local", "share", "Exodus", "dev", "projects.db")
  }
}

const DB_PATH = getDbPath()

const dir = dirname(DB_PATH)
mkdirSync(dir, { recursive: true })

const sqlite = new Database(DB_PATH)
sqlite.exec("PRAGMA journal_mode = WAL;")

export const db = drizzle(sqlite, { schema: { projects, ideas } })

export function migrate() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      level TEXT,
      type TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ideas_project_id ON ideas(project_id);
    CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
    CREATE INDEX IF NOT EXISTS idx_ideas_level ON ideas(level);
  `)
}

// Projects
export function listProjects(): Project[] {
  return db.select().from(projects).orderBy(desc(projects.created_at)).all()
}

export function createProject(project: Project) {
  db.insert(projects)
    .values({
      id: project.id,
      name: project.name,
      color: project.color,
      created_at: project.created_at,
    })
    .run()
}

export function updateProject(id: string, data: Partial<Pick<Project, "name" | "color">>) {
  db.update(projects).set(data).where(eq(projects.id, id)).run()
}

export function deleteProject(id: string) {
  db.delete(projects).where(eq(projects.id, id)).run()
}

// Ideas
function normalizeIdea(row: {
  id: string
  project_id: string
  title: string
  description: string | null
  level: string | null
  type: string | null
  status: string
  created_at: number
  updated_at: number
}): Idea {
  return {
    id: row.id,
    project_id: row.project_id,
    title: row.title,
    description: row.description,
    level: row.level,
    type: row.type,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function listIdeas(projectId: string): Idea[] {
  const rows = db
    .select()
    .from(ideas)
    .where(eq(ideas.project_id, projectId))
    .orderBy(desc(ideas.created_at))
    .all()
  return rows.map(normalizeIdea)
}

export function getIdeaById(id: string): Idea | null {
  const row = db.select().from(ideas).where(eq(ideas.id, id)).get()
  return row ? normalizeIdea(row) : null
}

export function createIdea(idea: Idea) {
  db.insert(ideas)
    .values({
      id: idea.id,
      project_id: idea.project_id,
      title: idea.title,
      description: idea.description,
      level: idea.level,
      type: idea.type,
      status: idea.status,
      created_at: idea.created_at,
      updated_at: idea.updated_at,
    })
    .run()
}

export function updateIdea(
  id: string,
  data: Partial<Omit<Idea, "id" | "project_id" | "created_at">>,
) {
  const setData: Record<string, unknown> = { updated_at: Date.now() }
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      setData[key] = value
    }
  }
  db.update(ideas).set(setData).where(eq(ideas.id, id)).run()
}

export function deleteIdea(id: string) {
  db.delete(ideas).where(eq(ideas.id, id)).run()
}
