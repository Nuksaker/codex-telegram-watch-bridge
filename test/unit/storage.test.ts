import { afterEach, describe, expect, it } from 'vitest';
import { BridgeDatabase } from '../../src/storage/database.js';

let database: BridgeDatabase | undefined;
afterEach(() => database?.close());

describe('persistent mapping and deduplication', () => {
  it('deduplicates Stop events and maps Telegram messages', () => {
    database = new BridgeDatabase(':memory:');
    const event = { sessionId: 'session_12345678', turnId: 'turn_1234', project: 'app', cwd: 'C:\\app' };
    expect(database.recordStopEvent(event)).toBe(true);
    expect(database.recordStopEvent(event)).toBe(false);
    expect(database.countEvents()).toBe(1);
    database.mapMessage(22, 100, event.sessionId, event.turnId);
    expect(database.sessionForMessage(22, 100)).toBe(event.sessionId);
    database.setActiveTarget(22, event.sessionId);
    expect(database.activeTarget(22)).toBe(event.sessionId);
    expect(database.clearActiveTarget(22)).toBe(true);
    expect(database.activeTarget(22)).toBeUndefined();
    expect(database.clearActiveTarget(22)).toBe(false);
  });

  it('stores a safe job preview and interrupts unfinished jobs after restart', () => {
    database = new BridgeDatabase(':memory:');
    database.recordStopEvent({
      sessionId: 'session_12345678',
      turnId: 'turn_1234',
      project: 'app',
      cwd: 'C:\\app',
    });
    const queued = database.createJob('session_12345678', 101, 'hash-1', 'แก้หน้า login');
    const running = database.createJob('session_12345678', 102, 'hash-2', 'เพิ่ม tests');
    database.updateJob(running, 'running');

    expect(database.interruptUnfinishedJobs()).toBe(2);
    expect(database.recentJobs()).toEqual([
      expect.objectContaining({ jobId: running, promptPreview: 'เพิ่ม tests', status: 'interrupted' }),
      expect.objectContaining({ jobId: queued, promptPreview: 'แก้หน้า login', status: 'interrupted' }),
    ]);
  });
});
