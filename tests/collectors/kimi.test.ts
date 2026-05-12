import { describe, it, expect } from 'vitest';
import { KimiCollector } from '../../src/collectors/kimi.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '..', 'fixtures', 'kimi');

describe('KimiCollector', () => {
  it('parses wire.jsonl into SessionData', async () => {
    const collector = new KimiCollector(fixturesDir);
    const start = new Date('2026-04-01');
    const end = new Date('2026-05-01');
    const sessions = await collector.collect(start, end, { projects: {} });

    expect(sessions).toHaveLength(1);
    const s = sessions[0];
    expect(s.sessionId).toBe('sess-hash/sess-sid');
    expect(s.toolName).toBe('kimi');
    expect(s.userMessageCount).toBe(2);       // 2 TurnBegin
    expect(s.totalToolCalls).toBe(4);          // 4 ToolCall
    expect(s.summary).toBe('重构风控规则引擎');
    expect(s.interruptions).toBe(1);           // "不对，换个方案" matches correction signal
    expect(s.durationMinutes).toBeGreaterThan(0);
  });

  it('filters sessions outside time window', async () => {
    const collector = new KimiCollector(fixturesDir);
    const sessions = await collector.collect(new Date('2025-01-01'), new Date('2025-01-02'), { projects: {} });
    expect(sessions).toHaveLength(0);
  });
});
