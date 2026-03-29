import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Database, FileState, FileMetadata, getFileMetadata, getParentsToRoot, getFirstGenerationChildren, getTemplateForFile, canSkip } from '../core/microcycle'
import { unlinkSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const TEST_DB_PATH = resolve(process.cwd(), '.ascd/test-cli-state.db')
const TEST_FILES_DIR = resolve(process.cwd(), '.ascd/test-files')

function cleanup() {
	const files = [
		'test-cli-state.db',
		'test-cli-state.db-shm',
		'test-cli-state.db-wal',
		'test-cli-state.db.backup',
		'test-cli-state.db.backup-shm',
		'test-cli-state.db.backup-wal'
	]
	const testDir = resolve(process.cwd(), '.ascd')

	for (const file of files) {
		const path = resolve(testDir, file)
		if (existsSync(path)) {
			try {
				unlinkSync(path)
			} catch (e) {

			}
		}
	}

	if (existsSync(TEST_FILES_DIR)) {
		rmSync(TEST_FILES_DIR, { recursive: true, force: true })
	}
}

function createTestFile(path: string, content: string): void {
	const fullPath = resolve(TEST_FILES_DIR, path)
	const dir = dirname(fullPath)

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true })
	}

	writeFileSync(fullPath, content)
}

beforeAll(() => {
	cleanup()
	const testDir = resolve(process.cwd(), '.ascd')
	if (!existsSync(testDir)) {
		mkdirSync(testDir, { recursive: true })
	}

	mkdirSync(TEST_FILES_DIR, { recursive: true })

	createTestFile('acsd/vision.md', '# Vision\n\nTest vision file')
	createTestFile('acsd/architecture/modules.md', '# Modules\n\nTest modules file')
	createTestFile('acsd/architecture/reliability.md', '# Reliability\n\nTest reliability file')
	createTestFile('acsd/data_model.md', '# Data Model\n\nTest data model file')
	createTestFile('src/modules/data/acsd/architecture.md', '# Data Module Architecture')
	createTestFile('src/modules/data/acsd/interface.md', '# Data Module Interface')
	createTestFile('src/modules/data/tests/contract/data-contract.test.ts', 'describe("data contract", () => {})')
	createTestFile('src/modules/data/src/service.ts', 'export function service() {}')
	createTestFile('src/modules/events/acsd/architecture.md', '# Events Module Architecture')
	createTestFile('src/modules/events/acsd/interface.md', '# Events Module Interface')
	createTestFile('src/modules/events/tests/contract/events-contract.test.ts', 'describe("events contract", () => {})')
	createTestFile('src/modules/events/src/index.ts', 'export function index() {}')
})

afterAll(() => {
	cleanup()
})

describe('Microcycle Functions', () => {
	it('should get file metadata', () => {
		const metadata = getFileMetadata('acsd/vision.md', TEST_FILES_DIR)

		expect(metadata).toBeDefined()
		expect(typeof metadata.mtime).toBe('number')
		expect(typeof metadata.checksum).toBe('string')
		expect(metadata.checksum).toHaveLength(64)
	})

	it('should get different checksums for different files', () => {
		const meta1 = getFileMetadata('acsd/vision.md', TEST_FILES_DIR)
		const meta2 = getFileMetadata('acsd/data_model.md', TEST_FILES_DIR)

		expect(meta1.checksum).not.toBe(meta2.checksum)
	})

	it('should get same checksum for same file', () => {
		const meta1 = getFileMetadata('acsd/vision.md', TEST_FILES_DIR)
		const meta2 = getFileMetadata('acsd/vision.md', TEST_FILES_DIR)

		expect(meta1.checksum).toBe(meta2.checksum)
	})

	it('should get parents for file', () => {
		const parents = getParentsToRoot('src/modules/data/src/service.ts', 'acsd/vision.md')

		expect(parents).toBeDefined()
		expect(Array.isArray(parents)).toBe(true)
		expect(parents.length).toBeGreaterThan(0)
	})

	it('should return empty parents for vision.md', () => {
		const parents = getParentsToRoot('acsd/vision.md', 'acsd/vision.md')

		expect(parents).toEqual([])
	})

	it('should get children for vision.md', () => {
		const children = getFirstGenerationChildren('acsd/vision.md')

		expect(children).toBeDefined()
		expect(Array.isArray(children)).toBe(true)
		expect(children.length).toBeGreaterThan(0)

		const architectureFiles = children.filter(c => c.startsWith('acsd/architecture/'))
		expect(architectureFiles.length).toBeGreaterThan(0)
	})

	it('should get children for architecture level', () => {
		const children = getFirstGenerationChildren('acsd/architecture/modules.md')

		expect(children).toBeDefined()
		expect(Array.isArray(children)).toBe(true)

		const dataModelChild = children.find(c => c === 'acsd/data_model.md')
		expect(dataModelChild).toBeDefined()
	})

	it('should return empty children for leaf level', () => {
		const children = getFirstGenerationChildren('src/modules/data/src/service.ts')

		expect(children).toEqual([])
	})

	it('should get template info for vision.md', () => {
		const template = getTemplateForFile('acsd/vision.md')

		expect(template).toBeDefined()
		expect(template.type).toBe('vision')
		expect(template.template).toBe('vision.md')
		expect(template.module).toBeNull()
	})

	it('should get template info for architecture file', () => {
		const template = getTemplateForFile('acsd/architecture/modules.md')

		expect(template).toBeDefined()
		expect(template.type).toBe('architecture')
		expect(template.template).toBe('architecture.md')
		expect(template.module).toBeNull()
	})

	it('should get template info for module architecture', () => {
		const template = getTemplateForFile('src/modules/data/acsd/architecture.md')

		expect(template).toBeDefined()
		expect(template.type).toBe('module_architecture')
		expect(template.module).toBe('data')
	})

	it('should get template info for module interface', () => {
		const template = getTemplateForFile('src/modules/data/acsd/interface.md')

		expect(template).toBeDefined()
		expect(template.type).toBe('module_interface')
		expect(template.module).toBe('data')
	})

	it('should return unknown template for unknown file', () => {
		const template = getTemplateForFile('unknown/file.txt')

		expect(template).toBeDefined()
		expect(template.type).toBe('unknown')
		expect(template.template).toBe('')
		expect(template.module).toBeNull()
	})

	it('should use canSkip with database', () => {
		const db = new Database(TEST_DB_PATH)

		const metadata = getFileMetadata('acsd/vision.md', TEST_FILES_DIR)

		const canSkip1 = canSkip('acsd/vision.md', metadata, TEST_DB_PATH)
		expect(canSkip1).toBe(false)

		const fileState: FileState = {
			status: 'OK',
			mtime: metadata.mtime,
			checksum: metadata.checksum,
			parents: []
		}

		db.updateFileState('acsd/vision.md', fileState)

		const canSkip2 = canSkip('acsd/vision.md', metadata, TEST_DB_PATH)
		expect(canSkip2).toBe(true)

		db.close()
	})

	it('should not skip when mtime changes', () => {
		const db = new Database(TEST_DB_PATH)

		const metadata = getFileMetadata('acsd/architecture/modules.md', TEST_FILES_DIR)

		const fileState: FileState = {
			status: 'OK',
			mtime: metadata.mtime,
			checksum: metadata.checksum,
			parents: []
		}

		db.updateFileState('acsd/architecture/modules.md', fileState)

		const canSkip1 = canSkip('acsd/architecture/modules.md', {
			mtime: metadata.mtime + 1000,
			checksum: metadata.checksum
		}, TEST_DB_PATH)

		expect(canSkip1).toBe(false)

		db.close()
	})

	it('should not skip when checksum changes', () => {
		const db = new Database(TEST_DB_PATH)

		const metadata = getFileMetadata('acsd/data_model.md', TEST_FILES_DIR)

		const fileState: FileState = {
			status: 'OK',
			mtime: metadata.mtime,
			checksum: metadata.checksum,
			parents: []
		}

		db.updateFileState('acsd/data_model.md', fileState)

		const canSkip1 = canSkip('acsd/data_model.md', {
			mtime: metadata.mtime,
			checksum: 'differentchecksum'
		}, TEST_DB_PATH)

		expect(canSkip1).toBe(false)

		db.close()
	})

	it('should not skip when parent is ERROR', () => {
		const db = new Database(TEST_DB_PATH)

		const parentMetadata = getFileMetadata('acsd/vision.md', TEST_FILES_DIR)
		const childMetadata = getFileMetadata('acsd/architecture/modules.md', TEST_FILES_DIR)

		const parentState: FileState = {
			status: 'ERROR',
			mtime: parentMetadata.mtime,
			checksum: parentMetadata.checksum,
			parents: []
		}

		const childState: FileState = {
			status: 'OK',
			mtime: childMetadata.mtime,
			checksum: childMetadata.checksum,
			parents: ['acsd/vision.md']
		}

		db.updateFileState('acsd/vision.md', parentState)
		db.updateFileState('acsd/architecture/modules.md', childState)

		const canSkipResult = canSkip('acsd/architecture/modules.md', childMetadata, TEST_DB_PATH)
		expect(canSkipResult).toBe(false)

		db.close()
	})

	it('should handle multiple levels of cascade', () => {
		const visionMetadata = getFileMetadata('acsd/vision.md', TEST_FILES_DIR)
		const dataModelMetadata = getFileMetadata('acsd/data_model.md', TEST_FILES_DIR)
		const moduleArchMetadata = getFileMetadata('src/modules/data/acsd/architecture.md', TEST_FILES_DIR)

		const db = new Database(TEST_DB_PATH)

		db.updateFileState('acsd/vision.md', {
			status: 'OK',
			mtime: visionMetadata.mtime,
			checksum: visionMetadata.checksum,
			parents: []
		})

		const visionState = db.getFileState('acsd/vision.md')
		expect(visionState?.status).toBe('OK')

		db.updateFileState('acsd/data_model.md', {
			status: 'OK',
			mtime: dataModelMetadata.mtime,
			checksum: dataModelMetadata.checksum,
			parents: ['acsd/vision.md']
		})

		const dataModelState = db.getFileState('acsd/data_model.md')
		expect(dataModelState?.status).toBe('OK')

		const dataModelParents = db.getParents('acsd/data_model.md')
		expect(dataModelParents).toContain('acsd/vision.md')

		db.updateFileState('src/modules/data/acsd/architecture.md', {
			status: 'OK',
			mtime: moduleArchMetadata.mtime,
			checksum: moduleArchMetadata.checksum,
			parents: ['acsd/data_model.md']
		})

		const canSkip1 = canSkip('src/modules/data/acsd/architecture.md', moduleArchMetadata, TEST_DB_PATH)
		expect(canSkip1).toBe(true)

		db.updateGlobalState({
			status: 'STARTED'
		})

		db.updateFileState('acsd/data_model.md', {
			status: 'ERROR',
			mtime: dataModelMetadata.mtime,
			checksum: dataModelMetadata.checksum,
			parents: ['acsd/vision.md']
		})

		const canSkip2 = canSkip('src/modules/data/acsd/architecture.md', moduleArchMetadata, TEST_DB_PATH)
		expect(canSkip2).toBe(false)

		db.close()
	})

	it('should get template info for different modules', () => {
		const dataTemplate = getTemplateForFile('src/modules/data/acsd/interface.md')
		const eventsTemplate = getTemplateForFile('src/modules/events/acsd/interface.md')

		expect(dataTemplate.type).toBe('module_interface')
		expect(dataTemplate.module).toBe('data')

		expect(eventsTemplate.type).toBe('module_interface')
		expect(eventsTemplate.module).toBe('events')
	})

	it('should handle complex parent relationships', () => {
		const parents = getParentsToRoot('src/modules/data/src/service.ts', 'acsd/vision.md')

		expect(parents.length).toBeGreaterThan(0)

		const hasDataInterface = parents.includes('src/modules/data/acsd/interface.md')
		expect(hasDataInterface).toBe(true)
	})

	it('should get children for different cascade levels', () => {
		const visionChildren = getFirstGenerationChildren('acsd/vision.md')
		const archChildren = getFirstGenerationChildren('acsd/architecture/modules.md')
		const dataModelChildren = getFirstGenerationChildren('acsd/data_model.md')

		expect(visionChildren.length).toBeGreaterThan(0)
		expect(archChildren.length).toBeGreaterThan(0)
		expect(dataModelChildren.length).toBeGreaterThan(0)
	})
})
