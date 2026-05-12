export interface TokenUsage {
  input: number;
  output: number;
  cacheCreation?: number;
  cacheRead?: number;
}

export interface SessionData {
  sessionId: string;
  projectPath: string;
  projectName: string;
  toolName: 'claude' | 'kimi';
  startTime: string;
  endTime: string;
  durationMinutes: number;
  userMessageCount: number;
  assistantMessageCount: number;
  totalToolCalls: number;
  toolErrors: number;
  tokens: TokenUsage;
  summary: string;
  outcome: string | null;
  userMessageTimestamps: string[];
  interruptions: number;
  autonomousMs: number;
}

export interface Tier1Metrics {
  inputFrequencyPerHour: number;
  avgInteractionMin: number;
  avgAutonomousMin: number;
  interruptionRate: number;
}

export interface Tier2Metrics {
  avgInputTokensPerMsg: number;
  avgOutputTokensPerMsg: number;
  inputOutputRatio: number;
}

export interface Tier3Metrics {
  cacheHitRate: number;
  toolCallDensity: number;
  completionRate: number;
  estimatedCost: number;
  toolErrorRate: number;
}

export interface ProjectSnapshot {
  name: string;
  path: string;
  sessionCount: number;
  totalTokens: { input: number; output: number };
  tier1: Tier1Metrics;
  tier2: Tier2Metrics;
  tier3: Tier3Metrics;
  summaries: string[];
}

export interface WeeklySnapshot {
  week: string;
  range: { start: string; end: string };
  generatedAt: string;
  global: {
    totalSessions: number;
    totalTokens: { input: number; output: number };
    estimatedCost: number;
    inputOutputRatio: number;
    avgSessionDurationMin: number;
    cacheHitRate: number;
    avgToolCallsPerResponse: number;
    completionRate: number;
    toolErrorRate: number;
  };
  projects: ProjectSnapshot[];
}

export interface AppConfig {
  projects: Record<string, string>;
}
