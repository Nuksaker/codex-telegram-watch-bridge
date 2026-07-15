import { describe, expect, it } from 'vitest';
import { installHookDocument, uninstallHookDocument } from '../../src/hook/installer.js';

describe('hook installer', () => {
  it('round-trips without losing unrelated hooks and is idempotent', () => {
    const original = {
      custom: { keep: true },
      hooks: { Stop: [{ hooks: [{ type: 'command', command: 'other.exe', statusMessage: 'Other hook' }] }], PreToolUse: [] },
    };
    const first = installHookDocument(original, 'node bridge.js');
    expect(first.changed).toBe(true);
    expect(installHookDocument(first.document, 'node bridge.js').changed).toBe(false);
    const updated = installHookDocument(first.document, 'node updated-bridge.js');
    expect(updated.changed).toBe(true);
    expect(updated.document.hooks?.Stop?.[1]?.hooks?.[0]).toMatchObject({
      command: 'node updated-bridge.js',
      commandWindows: 'node updated-bridge.js',
      timeout: 5,
    });
    const removed = uninstallHookDocument(first.document);
    expect(removed.changed).toBe(true);
    expect(removed.document).toEqual(original);
  });
});
