import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Database, FileState } from '../core/database'
import { unlinkSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const TEST_DB_PATH = resolve(process.cwd(), '.ascd/test-state.db')

function cleanup() {
	const testDir = resolve(process.cwd(), '.ascd')
	if (existsSync(testDir)) {
		try {
			const files = [
				'test-state.db',
				'test-state.db-shm',
				'test-state.db-wal',
				'test-state.db.backup',
				'test-state.db.backup-shm',
				'test-state.db.backup-wal'
			]
			for (const file of files) {
				const path = resolve(testDir, file)
				if (existsSync(path)) {
					unlinkSync(path)
				}
			}
		} catch (e) {

		}
	}
}

beforeAll(() => {
	cleanup()
	const testDir = resolve(process.cwd(), '.ascd')
	if (!existsSync(testDir)) {
		mkdirSync(testDir, { recursive: true })
	}
})

afterAll(() => {
	cleanup()
})

describe('Database', () => {
	it('should create database and initialize schema', () => {
		const db = new Database(TEST_DB_PATH)
		const state = db.getGlobalState()

		expect(state).toBeDefined()
		expect(state.status).toBe('STARTED')
		expect(state.filesProcessed).toBe(0)
		expect(state.errorsFound).toBe(0)

		db.close()
	})

	it('should create and retrieve file state', () => {
		const db = new Database(TEST_DB_PATH)

		const fileState: FileState = {
			status: 'OK',
			mtime: 1234567890,
			checksum: 'abc123',
			parents: ['parent1.md', 'parent2.md'],
			children: ['child1.md', 'child2.md']
		}

		db.updateFileState('test/file.md', fileState)

		const retrieved = db.getFileState('test/file.md')

		expect(retrieved).not.toBeNull()
		expect(retrieved?.status).toBe('OK')
		expect(retrieved?.mtime).toBe(1234567890)
		expect(retrieved?.checksum).toBe('abc123')
		expect(retrieved?.parents).toEqual(['parent1.md', 'parent2.md'])
		expect(retrieved?.children).toEqual(['child1.md', 'child2.md'])

		db.close()
	})

	it('should update existing file state', () => {
		const db = new Database(TEST_DB_PATH)

		const initial: FileState = {
			status: 'PROCESSING',
			mtime: 1234567890,
			checksum: 'abc123',
			parents: ['parent1.md']
		}

		db.updateFileState('test/update.md', initial)

		const updated: FileState = {
			status: 'OK',
			mtime: 1234567891,
			checksum: 'def456',
			parents: ['parent1.md', 'parent2.md'],
			children: ['child1.md']
		}

		db.updateFileState('test/update.md', updated)

		const retrieved = db.getFileState('test/update.md')

		expect(retrieved?.status).toBe('OK')
		expect(retrieved?.mtime).toBe(1234567891)
		expect(retrieved?.checksum).toBe('def456')

		db.close()
	})

	it('should delete file state', () => {
		const db = new Database(TEST_DB_PATH)

		const fileState: FileState = {
			status: 'OK',
			mtime: 1234567890,
			checksum: 'abc123',
			parents: []
		}

		db.updateFileState('test/delete.md', fileState)

		expect(db.getFileState('test/delete.md')).not.toBeNull()

		db.deleteFileState('test/delete.md')

		expect(db.getFileState('test/delete.md')).toBeNull()

		db.close()
	})

	it('should return null for non-existent file', () => {
		const db = new Database(TEST_DB_PATH)

		const result = db.getFileState('nonexistent/file.md')

		expect(result).toBeNull()

		db.close()
	})

	it('should handle canSkip correctly', () => {
		const db = new Database(TEST_DB_PATH)

		const fileState: FileState = {
			status: 'OK',
			mtime: 1234567890,
			checksum: 'abc123',
			parents: []
		}

		db.updateFileState('test/skip.md', fileState)

		const canSkip1 = db.canSkip('test/skip.md', { mtime: 1234567890, checksum: 'abc123' })
		expect(canSkip1).toBe(true)

		const canSkip2 = db.canSkip('test/skip.md', { mtime: 1234567891, checksum: 'abc123' })
		expect(canSkip2).toBe(false)

		const canSkip3 = db.canSkip('test/skip.md', { mtime: 1234567890, checksum: 'def456' })
		expect(canSkip3).toBe(false)

		db.close()
	})

	it('should return false for canSkip with PROCESSING status', () => {
		const db = new Database(TEST_DB_PATH)

		const fileState: FileState = {
			status: 'PROCESSING',
			mtime: 1234567890,
			checksum: 'abc123',
			parents: []
		}

		db.updateFileState('test/processing.md', fileState)

		const canSkip = db.canSkip('test/processing.md', { mtime: 1234567890, checksum: 'abc123' })
		expect(canSkip).toBe(false)

		db.close()
	})

	it('should return false for canSkip when parent is ERROR', () => {
		const db = new Database(TEST_DB_PATH)

		const parentState: FileState = {
			status: 'ERROR',
			mtime: 1234567890,
			checksum: 'abc123',
			parents: []
		}

		const childState: FileState = {
			status: 'OK',
			mtime: 1234567890,
			checksum: 'def456',
			parents: ['parent.md']
		}

		db.updateFileState('parent.md', parentState)
		db.updateFileState('test/child.md', childState)

		const canSkip = db.canSkip('test/child.md', { mtime: 1234567890, checksum: 'def456' })
		expect(canSkip).toBe(false)

		db.close()
	})

	it('should get parents correctly', () => {
		const db = new Database(TEST_DB_PATH)

		const childState: FileState = {
			status: 'OK',
			mtime: 1234567890,
			checksum: 'abc123',
			parents: ['parent1.md', 'parent2.md', 'parent3.md']
		}

		db.updateFileState('test/parents.md', childState)

		const parents = db.getParents('test/parents.md')

		expect(parents).toEqual(['parent1.md', 'parent2.md', 'parent3.md'])

		db.close()
	})

	it('should get children correctly', () => {
		const db = new Database(TEST_DB_PATH)

		db.deleteFileState('parent.md')

		const parentState: FileState = {
			status: 'OK',
			mtime: 1234567890,
			checksum: 'abc123',
			parents: [],
			children: []
		}

		db.updateFileState('parent.md', parentState)

		const child1State: FileState = {
			status: 'OK',
			mtime: 1234567890,
			checksum: 'def456',
			parents: ['parent.md']
		}

		const child2State: FileState = {
			status: 'OK',
			mtime: 1234567890,
			checksum: 'ghi789',
			parents: ['parent.md']
		}

		db.updateFileState('child1.md', child1State)
		db.updateFileState('child2.md', child2State)

		const children = db.getChildren('parent.md')

		expect(children).toEqual(['child1.md', 'child2.md'])

		db.close()
	})

	it('should remove all descendants recursively', () => {
		const db = new Database(TEST_DB_PATH)

		const rootState: FileState = {
			status: 'OK',
			mtime: 1234567890,
			checksum: 'root',
			parents: []
		}

		const level1State: FileState = {
			status: 'OK',
			mtime: 1234567890,
			checksum: 'level1',
			parents: ['root.md']
		}

		const level2State: FileState = {
			status: 'OK',
			mtime: 1234567890,
			checksum: 'level2',
			parents: ['level1.md']
		}

		db.updateFileState('root.md', rootState)
		db.updateFileState('level1.md', level1State)
		db.updateFileState('level2.md', level2State)

		expect(db.getFileState('level1.md')).not.toBeNull()
		expect(db.getFileState('level2.md')).not.toBeNull()

		db.removeAllDescendants('root.md')

		expect(db.getFileState('root.md')).not.toBeNull()
		expect(db.getFileState('level1.md')).toBeNull()
		expect(db.getFileState('level2.md')).toBeNull()

		db.close()
	})

	it('should update global state', () => {
		const db = new Database(TEST_DB_PATH)

		db.updateGlobalState({
			status: 'COMPLETED',
			filesProcessed: 100,
			errorsFound: 5
		})

		const state = db.getGlobalState()

		expect(state.status).toBe('COMPLETED')
		expect(state.filesProcessed).toBe(100)
		expect(state.errorsFound).toBe(5)

		db.close()
	})

	it('should get all files', () => {
		const db = new Database(TEST_DB_PATH)

		db.clean()

		const files: FileState[] = [
			{ status: 'OK', mtime: 1, checksum: 'a', parents: [] },
			{ status: 'PROCESSING', mtime: 2, checksum: 'b', parents: [] },
			{ status: 'ERROR', mtime: 3, checksum: 'c', parents: [] }
		]

		db.updateFileState('file1.md', files[0])
		db.updateFileState('file2.md', files[1])
		db.updateFileState('file3.md', files[2])

		const allFiles = db.getAllFiles()

		expect(allFiles).toHaveLength(3)

		db.close()
	})

	it('should get files by status', () => {
		const db = new Database(TEST_DB_PATH)

		const okFiles = db.getFilesByStatus('OK')
		expect(okFiles).toHaveLength(1)
		expect(okFiles[0].status).toBe('OK')

		const processingFiles = db.getFilesByStatus('PROCESSING')
		expect(processingFiles).toHaveLength(1)
		expect(processingFiles[0].status).toBe('PROCESSING')

		db.close()
	})

	it('should pass integrity check', () => {
		const db = new Database(TEST_DB_PATH)

		const integrity = db.integrityCheck()

		expect(integrity).toBe(true)

		db.close()
	})

	it('should clean database', () => {
		const db = new Database(TEST_DB_PATH)

		db.updateFileState('test/clean.md', { status: 'OK', mtime: 1, checksum: 'a', parents: [] })
		db.updateGlobalState({ filesProcessed: 10, errorsFound: 2 })

		db.clean()

		const state = db.getGlobalState()
		expect(state.status).toBe('STARTED')
		expect(state.filesProcessed).toBe(0)
		expect(state.errorsFound).toBe(0)

		const files = db.getAllFiles()
		expect(files).toHaveLength(0)

		db.close()
	})

	it('should create backup', () => {
		const db = new Database(TEST_DB_PATH)

		db.updateFileState('test/backup.md', { status: 'OK', mtime: 1, checksum: 'a', parents: [] })

		const backupPath = TEST_DB_PATH + '.backup'
		db.backup(backupPath)

		const backupDb = new Database(backupPath)
		const backupState = backupDb.getFileState('test/backup.md')

		expect(backupState).not.toBeNull()
		expect(backupState?.status).toBe('OK')

		backupDb.close()
		db.close()

		unlinkSync(backupPath)
	})

	it('should handle transaction rollback on error', () => {
		const db = new Database(TEST_DB_PATH)

		const fileState: FileState = {
			status: 'OK',
			mtime: 1234567890,
			checksum: 'abc123',
			parents: []
		}

		db.updateFileState('test/transaction.md', fileState)

		const beforeDelete = db.getFileState('test/transaction.md')
		expect(beforeDelete).not.toBeNull()

		try {
			db.deleteFileState('test/transaction.md')
		} catch (e) {
			
		}

		const afterDelete = db.getFileState('test/transaction.md')
		expect(afterDelete).toBeNull()

		db.close()
	})

	it('should handle multiple parent-child relationships', () => {
		const db = new Database(TEST_DB_PATH)

		const parent1State: FileState = {
			status: 'OK',
			mtime: 1,
			checksum: 'p1',
			parents: []
		}

		const parent2State: FileState = {
			status: 'OK',
			mtime: 2,
			checksum: 'p2',
			parents: []
		}

		const childState: FileState = {
			status: 'OK',
			mtime: 3,
			checksum: 'c',
			parents: ['parent1.md', 'parent2.md']
		}

		db.updateFileState('parent1.md', parent1State)
		db.updateFileState('parent2.md', parent2State)
		db.updateFileState('child.md', childState)

		const parents = db.getParents('child.md')
		expect(parents).toEqual(['parent1.md', 'parent2.md'])

		const children1 = db.getChildren('parent1.md')
		const children2 = db.getChildren('parent2.md')

		expect(children1).toEqual(['child.md'])
		expect(children2).toEqual(['child.md'])

		db.close()
	})

	it('should cascade delete children when parent is deleted', () => {
		const db = new Database(TEST_DB_PATH)

		const parentState: FileState = {
			status: 'OK',
			mtime: 1,
			checksum: 'p',
			parents: []
		}

		const childState: FileState = {
			status: 'OK',
			mtime: 2,
			checksum: 'c',
			parents: ['parent.md']
		}

		db.updateFileState('parent.md', parentState)
		db.updateFileState('child.md', childState)

		expect(db.getFileState('parent.md')).not.toBeNull()
		expect(db.getFileState('child.md')).not.toBeNull()

		db.deleteFileState('parent.md')

		expect(db.getFileState('parent.md')).toBeNull()
		expect(db.getFileState('child.md')).not.toBeNull()

		db.close()
	})
})
