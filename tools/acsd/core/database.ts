import { Database as SQLiteDatabase } from 'bun:sqlite'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

export interface FileMetadata {
  mtime: number
  checksum: string
}

export interface FileState {
  status: 'PROCESSING' | 'ERROR' | 'OK'
  mtime?: number
  checksum?: string
  parents: string[]
  children?: string[]
}

export interface State {
  timestamp: string
  status: 'STARTED' | 'COMPLETED' | 'FAILED'
  filesProcessed: number
  errorsFound: number
}

export class Database {
  private db!: SQLiteDatabase
  private dbPath: string

  constructor(dbPath?: string) {
    this.dbPath = dbPath || resolve(process.cwd(), '.ascd/state.db')
    this.init()
  }

  private init(): void {
    this.db = new SQLiteDatabase(this.dbPath)
    this.db.exec('PRAGMA foreign_keys = ON')
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA synchronous = FULL')
    this.initSchema()
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        timestamp TEXT NOT NULL,
        status TEXT NOT NULL,
        files_processed INTEGER DEFAULT 0,
        errors_found INTEGER DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        mtime INTEGER,
        checksum TEXT,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS file_relations (
        parent_path TEXT NOT NULL,
        child_path TEXT NOT NULL,
        PRIMARY KEY (parent_path, child_path)
      );

      CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
      CREATE INDEX IF NOT EXISTS idx_files_mtime_checksum ON files(mtime, checksum);
      CREATE INDEX IF NOT EXISTS idx_relations_parent ON file_relations(parent_path);
      CREATE INDEX IF NOT EXISTS idx_relations_child ON file_relations(child_path);
    `)

    this.db.query(`
      INSERT OR IGNORE INTO state (id, timestamp, status, files_processed, errors_found, updated_at)
      VALUES (1, datetime('now'), 'STARTED', 0, 0, ?)
    `).run(Math.floor(Date.now()))
  }

  getFileState(path: string): FileState | null {
    const stmt = this.db.query(`
      SELECT f.status, f.mtime, f.checksum,
        GROUP_CONCAT(r.parent_path) as parents
      FROM files f
      LEFT JOIN file_relations r ON f.path = r.child_path
      WHERE f.path = ?
      GROUP BY f.path
    `)

    const row = stmt.get(path) as any
    if (!row) return null

    const childrenStmt = this.db.query(`
      SELECT child_path FROM file_relations WHERE parent_path = ? ORDER BY child_path
    `)

    const childrenRows = childrenStmt.all(path) as any[]

    return {
      status: row.status,
      mtime: row.mtime,
      checksum: row.checksum,
      parents: row.parents ? row.parents.split(',') : [],
      children: childrenRows.map(r => r.child_path)
    }
  }

  updateFileState(path: string, fileState: FileState): void {
    this.db.transaction(() => {
      const now = Math.floor(Date.now())

      this.db.query(`
        INSERT OR REPLACE INTO files (path, status, mtime, checksum, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(path, fileState.status, fileState.mtime || null, fileState.checksum || null, now)

      const oldChildren = this.getChildren(path)

      this.db.query(`DELETE FROM file_relations WHERE child_path = ?`).run(path)

      const insertParentRelation = this.db.query(`
        INSERT OR IGNORE INTO file_relations (parent_path, child_path) VALUES (?, ?)
      `)

      for (const parentPath of fileState.parents) {
        insertParentRelation.run(parentPath, path)
      }

      const newChildren = fileState.children || oldChildren

      const insertChildRelation = this.db.query(`
        INSERT OR IGNORE INTO file_relations (parent_path, child_path) VALUES (?, ?)
      `)

      for (const childPath of newChildren) {
        insertChildRelation.run(path, childPath)
      }
    })()
  }

  deleteFileState(path: string): void {
    this.db.transaction(() => {
      this.db.query(`DELETE FROM file_relations WHERE parent_path = ? OR child_path = ?`).run(path, path)
      this.db.query(`DELETE FROM files WHERE path = ?`).run(path)
    })()
  }

  canSkip(path: string, metadata: FileMetadata): boolean {
    const stmt = this.db.query(`
      SELECT 1 FROM files f
      WHERE f.path = ?
        AND f.status = 'OK'
        AND f.mtime = ?
        AND f.checksum = ?
        AND NOT EXISTS (
          SELECT 1 FROM file_relations fr
          JOIN files p ON p.path = fr.parent_path
          WHERE fr.child_path = ? AND p.status != 'OK'
        )
    `)

    return !!stmt.get(path, metadata.mtime, metadata.checksum, path)
  }

  getParents(path: string): string[] {
    const stmt = this.db.query(`
      SELECT DISTINCT parent_path
      FROM file_relations
      WHERE child_path = ?
      ORDER BY parent_path
    `)

    const rows = stmt.all(path) as any[]
    return rows.map(r => r.parent_path)
  }

  getChildren(path: string): string[] {
    const stmt = this.db.query(`
      SELECT DISTINCT child_path
      FROM file_relations
      WHERE parent_path = ?
      ORDER BY child_path
    `)

    const rows = stmt.all(path) as any[]
    return rows.map(r => r.child_path)
  }

  removeAllDescendants(path: string): void {
    const descendants = this.collectDescendants(path)

    this.db.transaction(() => {
      for (const descendant of descendants) {
        this.db.query(`DELETE FROM file_relations WHERE parent_path = ? OR child_path = ?`).run(descendant, descendant)
        this.db.query(`DELETE FROM files WHERE path = ?`).run(descendant)
      }
    })()
  }

  private collectDescendants(path: string): Set<string> {
    const descendants = new Set<string>()
    const queue: string[] = [path]

    while (queue.length > 0) {
      const current = queue.shift()!
      const children = this.getChildren(current)

      for (const child of children) {
        if (!descendants.has(child)) {
          descendants.add(child)
          queue.push(child)
        }
      }
    }

    return descendants
  }

  getGlobalState(): State {
    const stmt = this.db.query(`
      SELECT timestamp, status, files_processed, errors_found
      FROM state
      WHERE id = 1
    `)

    const row = stmt.get() as any
    return {
      timestamp: row.timestamp,
      status: row.status,
      filesProcessed: row.files_processed,
      errorsFound: row.errors_found
    }
  }

  updateGlobalState(updates: Partial<State>): void {
    const updatesArr: string[] = []
    const values: any[] = []

    if (updates.timestamp !== undefined) {
      updatesArr.push('timestamp = ?')
      values.push(updates.timestamp)
    }
    if (updates.status !== undefined) {
      updatesArr.push('status = ?')
      values.push(updates.status)
    }
    if (updates.filesProcessed !== undefined) {
      updatesArr.push('files_processed = ?')
      values.push(updates.filesProcessed)
    }
    if (updates.errorsFound !== undefined) {
      updatesArr.push('errors_found = ?')
      values.push(updates.errorsFound)
    }

    if (updatesArr.length > 0) {
      updatesArr.push('updated_at = ?')
      values.push(Math.floor(Date.now()))

      this.db.query(`
        UPDATE state
        SET ${updatesArr.join(', ')}
        WHERE id = 1
      `).run(...values)
    }
  }

  getAllFiles(): FileState[] {
    const stmt = this.db.query(`SELECT path FROM files ORDER BY path`)
    const rows = stmt.all() as any[]

    return rows.map(row => {
      const state = this.getFileState(row.path)
      if (!state) throw new Error(`File state not found: ${row.path}`)
      return state
    })
  }

  getFilesByStatus(status: 'PROCESSING' | 'ERROR' | 'OK'): FileState[] {
    const stmt = this.db.query(`SELECT path FROM files WHERE status = ? ORDER BY path`)
    const rows = stmt.all(status) as any[]

    return rows.map(row => {
      const state = this.getFileState(row.path)
      if (!state) throw new Error(`File state not found: ${row.path}`)
      return state
    })
  }

  integrityCheck(): boolean {
    try {
      const result = this.db.query('PRAGMA integrity_check').get() as any
      return result.integrity_check === 'ok'
    } catch {
      return false
    }
  }

  backup(backupPath?: string): void {
    const targetPath = backupPath || this.dbPath + '.backup'

    try {
      const backupDb = new SQLiteDatabase(targetPath)
      backupDb.exec('PRAGMA foreign_keys = ON')
      backupDb.exec('PRAGMA journal_mode = WAL')
      backupDb.exec('PRAGMA synchronous = FULL')

      const backupDb2 = backupDb
      const schema = this.db.query("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL").all() as any[]
      
      for (const table of schema) {
        backupDb2.exec(table.sql)
      }

      const tables = this.db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]
      
      for (const table of tables) {
        if (table.name !== 'sqlite_sequence') {
          try {
            const rows = this.db.query(`SELECT * FROM ${table.name}`).all()
            if (rows.length > 0) {
              const cols = Object.keys(rows[0] as object)
              const placeholders = cols.map(() => '?').join(',')
              const colsStr = cols.join(',')
              
              const insert = backupDb2.query(`INSERT INTO ${table.name} (${colsStr}) VALUES (${placeholders})`)
              
              for (const row of rows) {
                insert.run(...cols.map(c => (row as any)[c]))
              }
            }
          } catch (e) {

          }
        }
      }

      backupDb2.close()
    } catch (error) {
      console.error('Backup failed:', error)
      throw error
    }
  }

  clean(): void {
    this.db.exec(`
      DELETE FROM file_relations;
      DELETE FROM files;
      UPDATE state
      SET timestamp = datetime('now'),
          status = 'STARTED',
          files_processed = 0,
          errors_found = 0,
          updated_at = strftime('%s', 'now') * 1000
      WHERE id = 1
    `)
  }

  close(): void {
    this.db.close()
  }
}
