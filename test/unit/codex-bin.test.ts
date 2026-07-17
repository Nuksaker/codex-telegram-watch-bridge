import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveCodexBinForSetup } from '../../src/config/codex-bin.js';

const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))));

describe('setup Codex executable resolution', () => {
  it('uses a valid project executable when runtime setup contains the unusable codex default', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-codex-bin-'));
    dirs.push(root);
    const runtimeDir = path.join(root, 'runtime');
    const executable = path.join(root, 'codex.exe');
    const projectEnv = path.join(root, '.env');
    await fs.mkdir(runtimeDir, { recursive: true });
    await fs.writeFile(path.join(runtimeDir, '.env'), 'CODEX_BIN=codex\n', 'utf8');
    await fs.writeFile(projectEnv, `CODEX_BIN=${executable}\n`, 'utf8');
    await fs.writeFile(executable, '', 'utf8');

    await expect(resolveCodexBinForSetup({
      runtimeDir,
      projectEnvPath: projectEnv,
      environment: {},
    })).resolves.toBe(executable);
  });

  it('preserves an existing valid runtime executable', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-codex-bin-'));
    dirs.push(root);
    const runtimeDir = path.join(root, 'runtime');
    const executable = path.join(root, 'runtime-codex.exe');
    await fs.mkdir(runtimeDir, { recursive: true });
    await fs.writeFile(path.join(runtimeDir, '.env'), `CODEX_BIN=${executable}\n`, 'utf8');
    await fs.writeFile(executable, '', 'utf8');

    await expect(resolveCodexBinForSetup({
      runtimeDir,
      projectEnvPath: path.join(root, 'missing.env'),
      environment: {},
    })).resolves.toBe(executable);
  });
});
