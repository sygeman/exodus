import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';

interface ACPMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

interface ModelConfig {
  provider: string;
  modelId: string;
  apiKey: string;
}

interface SessionUpdateParams {
  update?: {
    sessionUpdate?: string;
    content?: {
      type?: string;
      text?: string;
    };
  };
}

interface PermissionParams {
  sessionId: string;
  toolCall?: {
    toolCallId: string;
  };
}

interface SessionNewResult {
  sessionId: string;
}

export class OpenCodeExecutor {
  private process: ChildProcess | null = null;
  private messageId = 0;
  private pendingResponses = new Map<number, (response: unknown) => void>();
  private buffer = '';
  private sessionId: string | null = null;
  private messageChunks: string[] = [];
  private currentPromptResolver: ((value: { success: boolean; response: string }) => void) | null =
    null;
  private workingDir = '/projects';
  private taskConfigDir: string | null = null;
  private onChunkCallback: ((chunk: string) => void) | null = null;

  async connect(
    workingDir: string = CONFIG.DEFAULT_WORKING_DIR,
    modelConfig?: ModelConfig
  ): Promise<void> {
    this.workingDir = workingDir;
    console.log('[OpenCode] Starting opencode ACP process...');
    console.log(`[OpenCode] Working directory: ${workingDir}`);

    if (modelConfig) {
      this.taskConfigDir = await this.writeOpencodeConfig(modelConfig, workingDir);
    }

    return new Promise((resolve, reject) => {
      const opencodePath = CONFIG.OPENCODE_PATH;
      console.log('[OpenCode] Spawning:', opencodePath);

      this.process = spawn(opencodePath, ['acp'], {
        cwd: workingDir,
        env: process.env,
        shell: false,
      });

      if (!this.process.stdin || !this.process.stdout) {
        reject(new Error('Failed to create process streams'));
        return;
      }

      console.log('[OpenCode] Process spawned, PID:', this.process.pid);

      this.process.stdout.on('data', (data: Buffer) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        console.error('[OpenCode] stderr:', data.toString());
      });

      this.process.on('exit', (code) => {
        console.log(`[OpenCode] Process exited with code ${code}`);
        this.process = null;
        this.sessionId = null;
      });

      setTimeout(async () => {
        try {
          await this.initialize();
          await this.createSession();
          resolve();
        } catch (err) {
          reject(err);
        }
      }, CONFIG.CONNECTION_DELAY);
    });
  }

  private async initialize(): Promise<void> {
    await this.sendRequest({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: 1,
        capabilities: {},
        clientInfo: {
          name: 'exodus-execution',
          version: '1.0.0',
        },
      },
    });
    console.log('[OpenCode] Initialized');
  }

  private async createSession(): Promise<void> {
    const result = (await this.sendRequest({
      jsonrpc: '2.0',
      method: 'session/new',
      params: {
        cwd: this.workingDir,
        mcpServers: [],
      },
    })) as SessionNewResult;
    this.sessionId = result.sessionId;
    console.log('[OpenCode] Session created:', this.sessionId);
  }

  private processBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message: ACPMessage = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          console.error('[OpenCode] Failed to parse message:', line.substring(0, 200));
          console.error('[OpenCode] Parse error:', error);
        }
      }
    }
  }

  private handleMessage(message: ACPMessage) {
    if (message.id && this.pendingResponses.has(message.id)) {
      const resolve = this.pendingResponses.get(message.id)!;
      resolve(message.result ?? message.error);
      this.pendingResponses.delete(message.id);
      return;
    }

    if (message.method === 'session/update' && message.params) {
      this.handleSessionUpdate(message.params as SessionUpdateParams);
    }

    if (message.method === 'session/request_permission' && message.params) {
      const params = message.params as PermissionParams;
      console.log('[OpenCode] Auto-approving tool call:', params.toolCall?.toolCallId);
      this.respondToPermission(params.sessionId, params.toolCall?.toolCallId ?? '', true);
    }
  }

  private handleSessionUpdate(params: SessionUpdateParams) {
    const update = params.update;

    if (update?.sessionUpdate === 'agent_message_chunk' && update.content?.type === 'text') {
      const text = update.content.text ?? '';
      this.messageChunks.push(text);
      if (this.onChunkCallback) {
        this.onChunkCallback(text);
      }
    }
  }

  setOnChunk(callback: (chunk: string) => void): void {
    this.onChunkCallback = callback;
  }

  private async respondToPermission(
    sessionId: string,
    toolCallId: string,
    approved: boolean
  ): Promise<void> {
    try {
      await this.sendRequest({
        jsonrpc: '2.0',
        method: 'session/respond_permission',
        params: { sessionId, toolCallId, approved },
      });
    } catch (err) {
      console.error('[OpenCode] Failed to auto-approve permission:', err);
    }
  }

  private sendRequest(message: Omit<ACPMessage, 'id'>): Promise<unknown> {
    if (!this.process?.stdin) {
      throw new Error('OpenCode not connected');
    }

    return new Promise((resolve, reject) => {
      this.messageId++;
      const id = this.messageId;

      this.pendingResponses.set(id, resolve);

      const request: ACPMessage = { ...message, id };
      const messageStr = JSON.stringify(request) + '\n';

      this.process!.stdin!.write(messageStr, (err) => {
        if (err) {
          this.pendingResponses.delete(id);
          reject(err);
        }
      });

      setTimeout(() => {
        if (this.pendingResponses.has(id)) {
          this.pendingResponses.delete(id);
          reject(new Error('Request timeout'));
        }
      }, CONFIG.REQUEST_TIMEOUT);
    });
  }

  private async writeOpencodeConfig(modelConfig: ModelConfig, workingDir: string): Promise<string> {
    if (!modelConfig.apiKey?.trim()) {
      throw new Error('API key is required');
    }

    // Create task-specific config directory inside working directory for isolation
    const configDir = path.join(workingDir, '.exodus-config');
    const configPath = path.join(configDir, 'opencode.json');

    await fs.promises.mkdir(configDir, { recursive: true });

    const config = {
      $schema: 'https://opencode.ai/config.json',
      model: `${modelConfig.provider}/${modelConfig.modelId}`,
      provider: {
        [modelConfig.provider]: {
          options: { apiKey: modelConfig.apiKey },
        },
      },
    };

    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log(`[OpenCode] Config written to ${configPath}`);

    return configDir;
  }

  async executeTask(description: string): Promise<{ success: boolean; response: string }> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    console.log('[OpenCode] Executing task:', description.substring(0, 100));
    this.messageChunks = [];

    return new Promise((resolve, reject) => {
      this.currentPromptResolver = resolve;

      this.sendRequest({
        jsonrpc: '2.0',
        method: 'session/prompt',
        params: {
          sessionId: this.sessionId,
          prompt: [{ type: 'text', text: description }],
        },
      })
        .then(() => {
          setTimeout(() => {
            const fullResponse = this.messageChunks.join('');
            this.currentPromptResolver = null;
            resolve({ success: true, response: fullResponse || 'Готово' });
          }, CONFIG.CHUNK_RESOLUTION_DELAY);
        })
        .catch((err) => {
          this.currentPromptResolver = null;
          reject(err);
        });

      setTimeout(() => {
        if (this.currentPromptResolver) {
          const fullResponse = this.messageChunks.join('');
          this.currentPromptResolver({ success: true, response: fullResponse || 'Timeout' });
          this.currentPromptResolver = null;
        }
      }, CONFIG.TASK_TIMEOUT);
    });
  }

  isReady(): boolean {
    return this.sessionId !== null && this.process !== null;
  }

  async disconnect(): Promise<void> {
    console.log('[OpenCode] Disconnecting...');

    // Cleanup task-specific config directory
    if (this.taskConfigDir) {
      try {
        await fs.promises.rm(this.taskConfigDir, { recursive: true, force: true });
        console.log(`[OpenCode] Config directory cleaned up: ${this.taskConfigDir}`);
      } catch (err) {
        console.error('[OpenCode] Failed to cleanup config directory:', err);
      }
      this.taskConfigDir = null;
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
      this.sessionId = null;
    }
  }
}
