import { describe, it, expect } from 'vitest';
import { ClaudeCollector } from '../../src/collectors/claude.js';
import { resolve } from 'node:path';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures', 'claude');

describe('ClaudeCollector', () => {
  it('parses session-meta into SessionData', async () => {
    const collector = new ClaudeCollector(fixturesDir);
    const start = new Date('2026-05-05');
    const end = new Date('2026-05-13');
    const sessions = await collector.collect(start, end, { projects: {} });

    expect(sessions).toHaveLength(1);
    const s = sessions[0];
    expect(s.sessionId).toBe('sess-1');
    expect(s.projectPath).toBe('/Users/edy/projects/yj/risk-center');
    expect(s.projectName).toBe('risk-center');
    expect(s.toolName).toBe('claude');
    expect(s.durationMinutes).toBe(45);
    expect(s.userMessageCount).toBe(8);
    expect(s.assistantMessageCount).toBe(35);
    expect(s.tokens.input).toBe(120000);
    expect(s.tokens.output).toBe(45000);
    expect(s.summary).toBe('重构 RuleMatchExecutor 类，新增 DslRuleParser，全部测试通过');
    expect(s.outcome).toBe('completed');
    expect(s.interruptions).toBe(2);
    expect(s.totalToolCalls).toBe(18);
    expect(s.toolErrors).toBe(1);
    expect(s.userMessageTimestamps).toHaveLength(8);
  });

  it('filters sessions outside time window', async () => {
    const collector = new ClaudeCollector(fixturesDir);
    const start = new Date('2026-06-01');
    const end = new Date('2026-06-07');
    const sessions = await collector.collect(start, end, { projects: {} });
    expect(sessions).toHaveLength(0);
  });
});
