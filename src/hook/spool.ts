import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CodexStopEvent } from '../types.js';

export class EventSpool {
  private readonly spoolDir: string;

  constructor(runtimeDir: string, private readonly maxEntries = 100) {
    this.spoolDir = path.join(runtimeDir, 'spool');
  }

  async append(event: CodexStopEvent): Promise<void> {
    await fs.mkdir(this.spoolDir, { recursive: true });
    const base = `${Date.now()}-${randomUUID()}.json`;
    const temp = path.join(this.spoolDir, `${base}.tmp`);
    const target = path.join(this.spoolDir, base);
    await fs.writeFile(temp, JSON.stringify(event), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temp, target);
    await this.trim();
  }

  async drain(deliver: (event: CodexStopEvent) => Promise<boolean>): Promise<number> {
    const files = await this.list();
    let delivered = 0;
    for (const filename of files) {
      const fullPath = path.join(this.spoolDir, filename);
      try {
        const event = JSON.parse(await fs.readFile(fullPath, 'utf8')) as CodexStopEvent;
        if (!(await deliver(event))) break;
        await fs.unlink(fullPath);
        delivered += 1;
      } catch {
        const bad = `${fullPath}.bad`;
        await fs.rename(fullPath, bad).catch(() => undefined);
      }
    }
    return delivered;
  }

  async count(): Promise<number> {
    return (await this.list()).length;
  }

  private async list(): Promise<string[]> {
    try {
      return (await fs.readdir(this.spoolDir)).filter((file) => file.endsWith('.json')).sort();
    } catch {
      return [];
    }
  }

  private async trim(): Promise<void> {
    const files = await this.list();
    const excess = files.slice(0, Math.max(0, files.length - this.maxEntries));
    await Promise.all(excess.map((file) => fs.unlink(path.join(this.spoolDir, file))));
  }
}
