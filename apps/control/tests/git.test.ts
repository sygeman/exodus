import { describe, it, expect } from 'bun:test';
import { gitService } from '../src/services/git';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Git Service', () => {
  it('should initialize empty repository', async () => {
    const testDir = await mkdtemp(join(tmpdir(), 'exodus-test-'));
    
    await gitService.init(testDir);
    const isRepo = await gitService.isRepo(testDir);
    
    expect(isRepo).toBe(true);
    
    // Cleanup
    await rm(testDir, { recursive: true, force: true });
  });
});