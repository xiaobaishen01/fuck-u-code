import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { gitClone, isValidGitUrl, removeTempDir } from '../../src/utils/git.js';

const execFileAsync = promisify(execFile);

describe('git utils', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'fuck-u-code-git-'));
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  describe('isValidGitUrl', () => {
    it('accepts https, ssh and local paths', () => {
      expect(isValidGitUrl('https://github.com/user/repo.git')).toBe(true);
      expect(isValidGitUrl('git@github.com:user/repo.git')).toBe(true);
      expect(isValidGitUrl('./local/repo')).toBe(true);
      expect(isValidGitUrl('~/repo')).toBe(true);
    });

    it('rejects shell metacharacters and whitespace', () => {
      expect(isValidGitUrl('https://example.com/repo;rm -rf /')).toBe(false);
      expect(isValidGitUrl('https://example.com/repo$(id)')).toBe(false);
      expect(isValidGitUrl('https://example.com/repo`id`')).toBe(false);
      expect(isValidGitUrl('https://example.com/repo | cat')).toBe(false);
      expect(isValidGitUrl('https://example.com/repo "quoted"')).toBe(false);
      expect(isValidGitUrl('https://example.com/repo\n')).toBe(false);
    });
  });

  describe('gitClone', () => {
    it('clones a local repository', async () => {
      const source = join(tempRoot, 'source');
      await mkdir(source);
      await writeFile(join(source, 'file.txt'), 'hello');
      await execFileAsync('git', ['init', '-q', source]);
      await execFileAsync('git', ['-C', source, 'add', '.']);
      await execFileAsync('git', [
        '-C',
        source,
        '-c',
        'user.email=test@example.com',
        '-c',
        'user.name=test',
        'commit',
        '-qm',
        'init',
      ]);

      const target = join(tempRoot, 'clone');
      const result = await gitClone(source, { targetDir: target, timeout: 30000 });

      expect(result.success).toBe(true);
      expect(result.targetDir).toBe(target);
      await expect(stat(join(target, 'file.txt'))).resolves.toBeTruthy();
    }, 30000);

    it('never interprets a URL through a shell', async () => {
      const marker = join(tempRoot, 'pwned');
      const result = await gitClone(`./repo;echo pwned > ${marker}`, {
        targetDir: join(tempRoot, 'out'),
        timeout: 10000,
      });

      expect(result.success).toBe(false);
      await expect(stat(marker)).rejects.toThrow();
    });
  });

  describe('removeTempDir', () => {
    it('removes an existing directory and tolerates a missing one', async () => {
      const dir = join(tempRoot, 'temp-dir');
      await mkdir(dir);
      await writeFile(join(dir, 'x.txt'), 'x');

      await expect(removeTempDir(dir)).resolves.toBe(true);
      await expect(removeTempDir(join(tempRoot, 'missing'))).resolves.toBe(true);
    });
  });
});
