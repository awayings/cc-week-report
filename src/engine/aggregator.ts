import { SessionData, WeeklySnapshot } from '../types.js';
import { computeProjectMetrics } from './metrics.js';

export function buildSnapshot(
  sessions: SessionData[],
  range: { start: string; end: string },
  generatedAt: Date,
): WeeklySnapshot {
  const projects = new Map<string, SessionData[]>();

  for (const s of sessions) {
    const key = s.projectName;
    if (!projects.has(key)) projects.set(key, []);
    projects.get(key)!.push(s);
  }

  const n = sessions.length;
  const totalInput = sessions.reduce((sum, s) => sum + s.tokens.input, 0);
  const totalOutput = sessions.reduce((sum, s) => sum + s.tokens.output, 0);
  const totalMsgs = sessions.reduce((sum, s) => sum + s.userMessageCount + s.assistantMessageCount, 0);
  const totalToolCalls = sessions.reduce((sum, s) => sum + s.totalToolCalls, 0);
  const totalToolErrors = sessions.reduce((sum, s) => sum + s.toolErrors, 0);
  const totalCache = sessions.reduce((sum, s) => sum + (s.tokens.cacheCreation ?? 0) + (s.tokens.cacheRead ?? 0), 0);
  const completed = sessions.filter(s => s.outcome === 'completed').length;

  const global = {
    totalSessions: n,
    totalTokens: { input: totalInput, output: totalOutput },
    estimatedCost: 0,
    inputOutputRatio: totalOutput > 0 ? Math.round((totalInput / totalOutput) * 10) / 10 : 0,
    avgSessionDurationMin: n > 0
      ? Math.round((sessions.reduce((sum, s) => sum + s.durationMinutes, 0) / n) * 10) / 10
      : 0,
    cacheHitRate: totalInput > 0 ? Math.round((totalCache / totalInput) * 1000) / 1000 : 0,
    avgToolCallsPerResponse: totalMsgs > 0 ? Math.round((totalToolCalls / totalMsgs) * 1000) / 1000 : 0,
    completionRate: n > 0 ? Math.round((completed / n) * 1000) / 1000 : 0,
    toolErrorRate: totalToolCalls > 0 ? Math.round((totalToolErrors / totalToolCalls) * 1000) / 1000 : 0,
  };

  const allMetrics = computeProjectMetrics(sessions);
  global.estimatedCost = allMetrics.tier3.estimatedCost;

  const projectSnapshots = Array.from(projects.entries()).map(([name, projSessions]) => {
    const metrics = computeProjectMetrics(projSessions);
    return {
      name,
      path: projSessions[0].projectPath,
      sessionCount: projSessions.length,
      totalTokens: {
        input: projSessions.reduce((s, s2) => s + s2.tokens.input, 0),
        output: projSessions.reduce((s, s2) => s + s2.tokens.output, 0),
      },
      tier1: metrics.tier1,
      tier2: metrics.tier2,
      tier3: metrics.tier3,
      summaries: projSessions.map(s => s.summary).filter(Boolean),
    };
  });

  return {
    week: `Week of ${range.start}`,
    range,
    generatedAt: generatedAt.toISOString(),
    global,
    projects: projectSnapshots,
  };
}
