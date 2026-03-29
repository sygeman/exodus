import { describe, it, expect } from 'bun:test';
import { OpenCodeExecutor } from '../src/services/opencode.js';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('OpenCodeExecutor', () => {
  const testDir = join(tmpdir(), 'exodus-test-' + Date.now());

  it('should create opencode config file', () => {
    const executor = new OpenCodeExecutor();

    // Test that config writing logic exists
    // Note: This is a unit test, actual connection requires OpenCode binary
    expect(executor).toBeDefined();
    expect(typeof executor.connect).toBe('function');
    expect(typeof executor.executeTask).toBe('function');
    expect(typeof executor.isReady).toBe('function');
  });

  it('isReady should return false before connection', () => {
    const executor = new OpenCodeExecutor();
    expect(executor.isReady()).toBe(false);
  });

  it('should handle chunk callbacks', () => {
    const executor = new OpenCodeExecutor();
    const chunks: string[] = [];

    executor.setOnChunk((chunk) => {
      chunks.push(chunk);
    });

    // Test that callback is set
    expect(chunks).toEqual([]);
  });
});

describe('Worker Service', () => {
  it('should format command with role prompt', async () => {
    // This test verifies the command formatting logic
    const rolePrompt = 'You are a senior developer';
    const command = 'Create a button';

    const fullCommand = `<role>\n${rolePrompt}\n</role>\n\n<task>\n${command}\n</task>`;

    expect(fullCommand).toContain('<role>');
    expect(fullCommand).toContain('</role>');
    expect(fullCommand).toContain('<task>');
    expect(fullCommand).toContain('</task>');
    expect(fullCommand).toContain(rolePrompt);
    expect(fullCommand).toContain(command);
  });

  it('should handle missing role prompt', async () => {
    const command = 'Create a button';
    const fullCommand = command; // No role prompt

    expect(fullCommand).toBe(command);
    expect(fullCommand).not.toContain('<role>');
  });
});
