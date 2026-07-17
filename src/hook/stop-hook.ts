#!/usr/bin/env node
import { readHookConfig } from '../config/schema.js';
import { stopEventSchema } from '../security/validate.js';
import { deliverStopEvent } from './deliver.js';

async function readStdin(maxBytes = 64 * 1024): Promise<string> {
  let input = '';
  for await (const chunk of process.stdin) {
    input += String(chunk);
    if (Buffer.byteLength(input) > maxBytes) throw new Error('Hook input too large');
  }
  return input;
}

async function run(): Promise<void> {
  let config;
  let event;
  try {
    config = readHookConfig();
    event = stopEventSchema.parse(JSON.parse(await readStdin()));
  } catch {
    return;
  }
  await deliverStopEvent(config, event);
}

await run();
process.exitCode = 0;
