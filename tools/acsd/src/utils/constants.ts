import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const PROJECT_ROOT = resolve(__dirname, '../../../../..')
export const STATE_DIR = resolve(PROJECT_ROOT, '.acsd')
export const STATE_DB = resolve(STATE_DIR, 'state.db')
