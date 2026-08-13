import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { discoverFiles } from '../../src/analyzer/file-discovery.js';
import { createRuntimeConfig } from '../../src/config/index.js';
import { DEFAULT_CONFIG } from '../../src/config/schema.js';

describe('file discovery', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fuck-u-code-discovery-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function makeProject(): Promise<void> {
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'a.ts'), 'export const a = 1;\n');
    await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true });
    await writeFile(join(root, 'node_modules', 'pkg', 'index.js'), 'module.exports = {};\n');
    await mkdir(join(root, 'dist'), { recursive: true });
    await writeFile(join(root, 'dist', 'bundle.js'), 'console.log(1);\n');
  }

  it('skips common non-code directories by default', async () => {
    await makeProject();
    const config = createRuntimeConfig(root, DEFAULT_CONFIG, {});

    const result = await discoverFiles(config);

    expect(result.files.map((file) => file.relativePath.replace(/\\/g, '/'))).toEqual([
      'src/a.ts',
    ]);
  });

  it('includes explicitly requested directories', async () => {
    await makeProject();
    const config = createRuntimeConfig(root, DEFAULT_CONFIG, {
      include: ['src/**', 'node_modules/**', 'dist/**'],
    });

    const result = await discoverFiles(config);

    expect(
      result.files.map((file) => file.relativePath.replace(/\\/g, '/')).sort()
    ).toEqual([
      'dist/bundle.js',
      'node_modules/pkg/index.js',
      'src/a.ts',
    ]);
  });
});
