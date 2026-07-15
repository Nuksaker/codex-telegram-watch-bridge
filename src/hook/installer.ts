import fs from 'node:fs/promises';
import path from 'node:path';

export const HOOK_MARKER = 'Codex Telegram Bridge notification';

interface HookHandler {
  type?: string;
  command?: string;
  commandWindows?: string;
  timeout?: number;
  statusMessage?: string;
  [key: string]: unknown;
}

interface MatcherGroup {
  hooks?: HookHandler[];
  [key: string]: unknown;
}

interface HooksDocument {
  hooks?: Record<string, MatcherGroup[]>;
  [key: string]: unknown;
}

export function isBridgeHandler(handler: HookHandler): boolean {
  return handler.statusMessage === HOOK_MARKER;
}

export function installHookDocument(input: unknown, command: string): { document: HooksDocument; changed: boolean } {
  const document = structuredClone(isRecord(input) ? input : {}) as HooksDocument;
  document.hooks = isRecord(document.hooks) ? document.hooks : {};
  const groups = Array.isArray(document.hooks.Stop) ? document.hooks.Stop : [];
  let changed = false;
  const found = groups.some((group) => group.hooks?.some(isBridgeHandler) === true);
  if (found) {
    const nextGroups = groups.map((group) => {
      if (!group.hooks) return { ...group };
      return {
        ...group,
        hooks: group.hooks.map((handler) => {
          if (!isBridgeHandler(handler)) return handler;
          const next: HookHandler = {
            ...handler,
            type: 'command',
            command,
            commandWindows: command,
            timeout: 5,
            statusMessage: HOOK_MARKER,
          };
          if (JSON.stringify(next) !== JSON.stringify(handler)) changed = true;
          return next;
        }),
      };
    });
    document.hooks.Stop = nextGroups;
    return { document, changed };
  }
  groups.push({
    hooks: [{
      type: 'command',
      command,
      commandWindows: command,
      timeout: 5,
      statusMessage: HOOK_MARKER,
    }],
  });
  document.hooks.Stop = groups;
  return { document, changed: true };
}

export function uninstallHookDocument(input: unknown): { document: HooksDocument; changed: boolean } {
  const document = structuredClone(isRecord(input) ? input : {}) as HooksDocument;
  if (!isRecord(document.hooks) || !Array.isArray(document.hooks.Stop)) return { document, changed: false };
  let changed = false;
  const nextGroups = document.hooks.Stop.flatMap((group) => {
    if (!Array.isArray(group.hooks)) return [group];
    const handlers = group.hooks.filter((handler) => {
      const remove = isBridgeHandler(handler);
      changed ||= remove;
      return !remove;
    });
    return handlers.length ? [{ ...group, hooks: handlers }] : [];
  });
  if (nextGroups.length) document.hooks.Stop = nextGroups;
  else delete document.hooks.Stop;
  return { document, changed };
}

export async function readHookFile(filename: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(filename, 'utf8')) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

export async function writeHookFile(filename: string, document: HooksDocument): Promise<string | undefined> {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  let backup: string | undefined;
  try {
    await fs.access(filename);
    backup = `${filename}.backup-${new Date().toISOString().replaceAll(':', '-')}`;
    await fs.copyFile(filename, backup);
  } catch {
    // New hooks file does not need a backup.
  }
  const temp = `${filename}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await fs.rename(temp, filename);
  return backup;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
