export const CONFIG = {
  // Timeouts (in milliseconds)
  REQUEST_TIMEOUT: 900000, // 15 minutes
  TASK_TIMEOUT: 900000, // 15 minutes
  CONNECTION_DELAY: 1000, // 1 second
  CHUNK_RESOLUTION_DELAY: 1000, // 1 second

  // Connection retry settings
  MAX_CONNECTION_ATTEMPTS: 30,
  CONNECTION_RETRY_INTERVAL: 1000, // 1 second

  // Process settings
  OPENCODE_PATH: process.env.OPENCODE_PATH || '/root/.opencode/bin/opencode',

  // Default paths
  DEFAULT_WORKING_DIR: '/projects',
  DEFAULT_CONFIG_DIR: '.config/opencode',

  // Server settings
  DEFAULT_PORT: 3000,
} as const;
