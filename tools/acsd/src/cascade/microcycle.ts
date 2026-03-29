import { fileURLToPath } from 'node:url'
import { readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { Database, FileState, FileMetadata } from './database'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const PROJECT_ROOT = resolve(__dirname, '../../../')

export interface CascadeLevel {
  level: string
  path?: string
  glob?: string
  parents: string[]
}

const CASCADE: CascadeLevel[] = [
  {
    level: 'vision',
    path: 'acsd/vision.md',
    parents: [],
  },
  {
    level: 'architecture',
    glob: 'acsd/architecture/*.md',
    parents: ['vision'],
  },
  {
    level: 'data_model',
    path: 'acsd/data_model.md',
    parents: ['architecture', 'vision'],
  },
  {
    level: 'module_architecture',
    glob: 'src/modules/*/acsd/architecture.md',
    parents: ['data_model', 'architecture', 'vision'],
  },
  {
    level: 'module_interface',
    glob: 'src/modules/*/acsd/interface.md',
    parents: ['module_architecture', 'data_model', 'architecture', 'vision'],
  },
  {
    level: 'tests',
    glob: 'src/modules/*/tests/contract/*.test.ts',
    parents: ['module_interface', 'module_architecture', 'data_model', 'architecture', 'vision'],
  },
  {
    level: 'code',
    glob: 'src/modules/*/src/*.ts',
    parents: ['tests', 'module_interface', 'module_architecture', 'data_model', 'architecture', 'vision'],
  },
]

export function getFileMetadata(filePath: string, rootDir: string = PROJECT_ROOT): FileMetadata {
  const fullPath = resolve(rootDir, filePath)
  const stat = statSync(fullPath)
  const content = readFileSync(fullPath, 'utf-8')
  const checksum = createHash('sha256').update(content).digest('hex')
  return {
    mtime: Math.floor(stat.mtimeMs),
    checksum
  }
}

export function canSkip(filePath: string, metadata: FileMetadata, dbPath?: string): boolean {
  const db = new Database(dbPath)
  try {
    return db.canSkip(filePath, metadata)
  } finally {
    db.close()
  }
}

export function globSync(pattern: string, rootDir: string): string[] {
  const files: string[] = []

  const expandGlob = (baseDir: string, remainingPattern: string): void => {
    const parts = remainingPattern.split('/')
    const currentPart = parts[0]
    const rest = parts.slice(1).join('/')

    const isGlob = currentPart.includes('*')
    const currentPath = resolve(rootDir, baseDir, currentPart)

    if (isGlob) {
      try {
        const { readdirSync } = require('node:fs')
        const parentPath = resolve(rootDir, baseDir)
        const entries = readdirSync(parentPath)
        for (const entry of entries) {
          if (entry.match(/^[^.]/)) {
            const glob = new RegExp('^' + currentPart.replace('*', '.*') + '$')
            if (glob.test(entry)) {
              if (rest) {
                const nextDir = baseDir ? `${baseDir}/${entry}` : entry
                expandGlob(nextDir, rest)
              } else {
                const fullPath = baseDir ? `${baseDir}/${entry}` : entry
                files.push(fullPath)
              }
            }
          }
        }
      } catch {
        // Directory doesn't exist
      }
    } else {
      if (rest) {
        const nextDir = baseDir ? `${baseDir}/${currentPart}` : currentPart
        expandGlob(nextDir, rest)
      } else {
        const fullPath = baseDir ? `${baseDir}/${currentPart}` : currentPath
        files.push(fullPath)
      }
    }
  }

  expandGlob('', pattern)
  return [...new Set(files)]
}

function getLevel(filePath: string): CascadeLevel | undefined {
  return CASCADE.find(level => {
    if (level.glob) {
      const files = globSync(level.glob, PROJECT_ROOT)
      return files.includes(filePath)
    } else if (level.path) {
      return filePath === level.path
    }
    return false
  })
}

export function getParentsToRoot(filePath: string, rootFilePath: string): string[] {
  const parents: string[] = []
  const visited = new Set<string>()

  function collect(path: string) {
    if (path === rootFilePath || visited.has(path)) {
      return
    }
    visited.add(path)

    const level = getLevel(path)
    if (!level) return

    for (const parentLevelName of level.parents) {
      const parentLevel = CASCADE.find(l => l.level === parentLevelName)
      if (!parentLevel) continue

      const parentFiles: string[] = []
      if (parentLevel.glob) {
        parentFiles.push(...globSync(parentLevel.glob, PROJECT_ROOT))
      } else if (parentLevel.path) {
        parentFiles.push(parentLevel.path)
      }

      for (const parentFile of parentFiles) {
        const parentPath = parentFile.replace(PROJECT_ROOT + '/', '')
        if (path !== parentPath) {
          parents.push(parentPath)
          collect(parentPath)
        }
      }
    }
  }

  collect(filePath)
  return [...new Set(parents)]
}

export function getFirstGenerationChildren(filePath: string): string[] {
  const level = getLevel(filePath)
  if (!level) return []

  const currentIndex = CASCADE.findIndex(l => l.level === level.level)
  if (currentIndex === -1) return []

  const nextLevel = CASCADE[currentIndex + 1]
  if (!nextLevel) return []

  const children: string[] = []

  if (nextLevel.glob) {
    const files = globSync(nextLevel.glob, PROJECT_ROOT)
    children.push(...files.map(f => f.replace(PROJECT_ROOT + '/', '')))
  } else if (nextLevel.path) {
    children.push(nextLevel.path)
  }

  return [...new Set(children)]
}

export interface TemplateInfo {
  template: string
  type: string
  module: string | null
}

export function getTemplateForFile(filePath: string): TemplateInfo {
  const normalizedPath = filePath.replace(/^\//, '')

  if (normalizedPath === 'acsd/vision.md') {
    return { template: 'vision.md', type: 'vision', module: null }
  }

  if (normalizedPath.startsWith('acsd/architecture/')) {
    return { template: 'architecture.md', type: 'architecture', module: null }
  }

  if (normalizedPath === 'acsd/data_model.md') {
    return { template: 'data_model.md', type: 'data_model', module: null }
  }

  if (normalizedPath.startsWith('acsd/adr/')) {
    return { template: 'adr.md', type: 'adr', module: null }
  }

  const moduleMatch = normalizedPath.match(/src\/modules\/([^/]+)\/acsd\/(.+)\.md/)
  if (moduleMatch) {
    const module = moduleMatch[1]
    const innerPath = moduleMatch[2]

    if (innerPath === 'architecture') {
      return { template: 'module/architecture.md', type: 'module_architecture', module }
    }

    if (innerPath === 'capsule') {
      return { template: 'module/capsule.md', type: 'module_capsule', module }
    }

    if (innerPath === 'interface') {
      return { template: 'module/interface.md', type: 'module_interface', module }
    }
  }

  return { template: '', type: 'unknown', module: null }
}

export { Database }
export type { FileState, FileMetadata }
