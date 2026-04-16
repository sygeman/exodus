import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"
import { join, dirname } from "path"
import { projects } from "./schema"
import { desc, eq } from "drizzle-orm"
import { mkdirSync } from "fs"
import { Utils } from "electrobun/bun"
import type { Project } from "../events"

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

export const db = drizzle(sqlite, { schema: { projects } })

export function migrate() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
  `)
}

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
