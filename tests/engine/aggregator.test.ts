import { describe, it, expect } from 'vitest';
import { buildSnapshot } from '../../src/engine/aggregator.js';
import { SessionData } from '../../src/types.js';

describe('buildSnapshot', () => {
  it('groups sessions by project and computes global + per-project metrics', () => {
    const sessions: SessionData[] = [
      {
        sessionId: 's1', projectPath: '/tmp/proj-a', projectName: 'proj-a', toolName: 'claude',
        startTime: '2026-05-08T02:00:00Z', endTime: '2026-05-08T02:45:00Z',
        durationMinutes: 45, userMessageCount: 8, assistantMessageCount: 35,
        totalToolCalls: 18, toolErrors: 1,
        tokens: { input: 120000, output: 45000 },
        summary: '重构引擎', outcome: 'completed',
        userMessageTimestamps: [], interruptions: 2, autonomousMs: 1800000,
      },
      {
        sessionId: 's2', projectPath: '/tmp/proj-b', projectName: 'proj-b', toolName: 'claude',
        startTime: '2026-05-08T03:00:00Z', endTime: '2026-05-08T03:20:00Z',
        durationMinutes: 20, userMessageCount: 4, assistantMessageCount: 18,
        totalToolCalls: 10, toolErrors: 0,
        tokens: { input: 60000, output: 25000 },
        summary: '修复 bug', outcome: 'completed',
        userMessageTimestamps: [], interruptions: 0, autonomousMs: 900000,
      },
    ];

    const range = { start: '2026-05-05', end: '2026-05-12' };
    const snapshot = buildSnapshot(sessions, range, new Date('2026-05-12T15:30:00Z'));

    expect(snapshot.range).toEqual(range);
    expect(snapshot.global.totalSessions).toBe(2);
    expect(snapshot.global.totalTokens.input).toBe(180000);
    expect(snapshot.global.totalTokens.output).toBe(70000);
    expect(snapshot.projects).toHaveLength(2);

    const projA = snapshot.projects.find(p => p.name === 'proj-a')!;
    expect(projA.sessionCount).toBe(1);
    expect(projA.summaries).toEqual(['重构引擎']);
    expect(projA.totalTokens.input).toBe(120000);
  });

  it('handles empty sessions', () => {
    const snapshot = buildSnapshot([], { start: '2026-05-05', end: '2026-05-12' }, new Date());
    expect(snapshot.global.totalSessions).toBe(0);
    expect(snapshot.projects).toHaveLength(0);
  });
});
