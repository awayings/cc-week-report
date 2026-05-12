import { describe, it, expect } from 'vitest';
import { computeProjectMetrics } from '../../src/engine/metrics.js';
import { SessionData } from '../../src/types.js';

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sessionId: 'sess-1',
    projectPath: '/tmp/test',
    projectName: 'test',
    toolName: 'claude',
    startTime: '2026-05-08T02:00:00.000Z',
    endTime: '2026-05-08T02:45:00.000Z',
    durationMinutes: 45,
    userMessageCount: 8,
    assistantMessageCount: 35,
    totalToolCalls: 18,
    toolErrors: 1,
    tokens: { input: 120000, output: 45000 },
    summary: 'test summary',
    outcome: 'completed',
    userMessageTimestamps: [],
    interruptions: 2,
    autonomousMs: 1800000,
    ...overrides,
  };
}

describe('computeProjectMetrics', () => {
  it('computes all 12 metrics for a list of sessions', () => {
    const sessions = [
      makeSession(),
      makeSession({
        sessionId: 'sess-2',
        durationMinutes: 30,
        tokens: { input: 80000, output: 35000 },
        outcome: 'mostly_achieved',
        interruptions: 1,
        autonomousMs: 900000,
        toolErrors: 0,
      }),
    ];

    const m = computeProjectMetrics(sessions);

    // Tier 1
    expect(m.tier1.inputFrequencyPerHour).toBeCloseTo(12.8, 0); // (8+8) / (45+30) * 60
    expect(m.tier1.avgInteractionMin).toBeCloseTo(37.5, 1);
    expect(m.tier1.avgAutonomousMin).toBeCloseTo(22.5, 0); // (1800+900)/2/60
    expect(m.tier1.interruptionRate).toBeCloseTo(0.188, 3); // (2+1) / (8+8) rounded to 3dp

    // Tier 2
    expect(m.tier2.inputOutputRatio).toBeCloseTo(2.5, 1); // (120000+80000) / (45000+35000)
    expect(m.tier2.avgInputTokensPerMsg).toBeCloseTo(2325.58, 0); // 200000 / 86
    expect(m.tier2.avgOutputTokensPerMsg).toBeCloseTo(930.23, 0); // 80000 / 86

    // Tier 3
    expect(m.tier3.completionRate).toBeCloseTo(0.5, 1);
    expect(m.tier3.toolErrorRate).toBeCloseTo(0.0277, 3); // 1 / 36
    expect(m.tier3.cacheHitRate).toBe(0);
    expect(m.tier3.toolCallDensity).toBeCloseTo(0.4186, 2); // 36 / 86
    expect(m.tier3.estimatedCost).toBeGreaterThan(0);
  });

  it('handles empty sessions', () => {
    const m = computeProjectMetrics([]);
    expect(m.tier1.inputFrequencyPerHour).toBe(0);
    expect(m.tier1.avgInteractionMin).toBe(0);
    expect(m.tier2.inputOutputRatio).toBe(0);
    expect(m.tier3.completionRate).toBe(0);
    expect(m.tier3.estimatedCost).toBe(0);
  });
});
