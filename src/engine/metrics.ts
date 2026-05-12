import { SessionData, Tier1Metrics, Tier2Metrics, Tier3Metrics } from '../types.js';

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  default: { input: 3, output: 15 },
};

function estimateCost(sessions: SessionData[]): number {
  const pricing = MODEL_PRICING.default;
  let total = 0;
  for (const s of sessions) {
    total += (s.tokens.input / 1_000_000) * pricing.input;
    total += (s.tokens.output / 1_000_000) * pricing.output;
  }
  return Math.round(total * 100) / 100;
}

export function computeProjectMetrics(sessions: SessionData[]): {
  tier1: Tier1Metrics;
  tier2: Tier2Metrics;
  tier3: Tier3Metrics;
} {
  const n = sessions.length;
  if (n === 0) {
    return {
      tier1: { inputFrequencyPerHour: 0, avgInteractionMin: 0, avgAutonomousMin: 0, interruptionRate: 0 },
      tier2: { avgInputTokensPerMsg: 0, avgOutputTokensPerMsg: 0, inputOutputRatio: 0 },
      tier3: { cacheHitRate: 0, toolCallDensity: 0, completionRate: 0, estimatedCost: 0, toolErrorRate: 0 },
    };
  }

  // Tier 1
  const totalDuration = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalAutonomousMs = sessions.reduce((sum, s) => sum + s.autonomousMs, 0);
  const totalInterruptions = sessions.reduce((sum, s) => sum + s.interruptions, 0);
  const totalUserMsgs = sessions.reduce((sum, s) => sum + s.userMessageCount, 0);

  const tier1: Tier1Metrics = {
    inputFrequencyPerHour: Math.round((totalUserMsgs / Math.max(totalDuration, 1) * 60) * 10) / 10,
    avgInteractionMin: Math.round((totalDuration / n) * 10) / 10,
    avgAutonomousMin: Math.round((totalAutonomousMs / n / 60000) * 10) / 10,
    interruptionRate: Math.round((totalInterruptions / Math.max(totalUserMsgs, 1)) * 1000) / 1000,
  };

  // Tier 2
  const totalInput = sessions.reduce((sum, s) => sum + s.tokens.input, 0);
  const totalOutput = sessions.reduce((sum, s) => sum + s.tokens.output, 0);
  const totalMsgs = sessions.reduce((sum, s) => sum + s.userMessageCount + s.assistantMessageCount, 0);

  const tier2: Tier2Metrics = {
    avgInputTokensPerMsg: Math.round(totalInput / Math.max(totalMsgs, 1)),
    avgOutputTokensPerMsg: Math.round(totalOutput / Math.max(totalMsgs, 1)),
    inputOutputRatio: totalOutput > 0 ? Math.round((totalInput / totalOutput) * 10) / 10 : 0,
  };

  // Tier 3
  const totalCache = sessions.reduce((sum, s) => sum + (s.tokens.cacheCreation ?? 0) + (s.tokens.cacheRead ?? 0), 0);
  const totalToolCalls = sessions.reduce((sum, s) => sum + s.totalToolCalls, 0);
  const totalToolErrors = sessions.reduce((sum, s) => sum + s.toolErrors, 0);
  const completed = sessions.filter(s => s.outcome === 'completed').length;

  const tier3: Tier3Metrics = {
    cacheHitRate: totalInput > 0 ? Math.round((totalCache / totalInput) * 1000) / 1000 : 0,
    toolCallDensity: totalMsgs > 0 ? Math.round((totalToolCalls / totalMsgs) * 1000) / 1000 : 0,
    completionRate: Math.round((completed / n) * 1000) / 1000,
    estimatedCost: estimateCost(sessions),
    toolErrorRate: totalToolCalls > 0 ? Math.round((totalToolErrors / totalToolCalls) * 1000) / 1000 : 0,
  };

  return { tier1, tier2, tier3 };
}
