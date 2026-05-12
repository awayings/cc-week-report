import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Collector } from './interface.js';
import { SessionData, AppConfig } from '../types.js';
import { resolveProjectName } from '../config.js';

interface SessionMeta {
  session_id: string;
  project_path: string;
  start_time: string;
  duration_minutes: number;
  user_message_count: number;
  assistant_message_count: number;
  tool_counts: Record<string, number>;
  input_tokens: number;
  output_tokens: number;
  user_interruptions: number;
  tool_errors: number;
  user_message_timestamps: string[];
}

interface FacetData {
  outcome?: string;
  brief_summary?: string;
  session_id: string;
}

export class ClaudeCollector implements Collector {
  readonly name = 'claude';

  constructor(private usageDataDir: string = resolve(process.env.HOME ?? '~', '.claude', 'usage-data')) {}

  collect(start: Date, end: Date, config: AppConfig): Promise<SessionData[]> {
    const sessions: SessionData[] = [];
    const metaDir = resolve(this.usageDataDir, 'session-meta');
    const facetsDir = resolve(this.usageDataDir, 'facets');

    if (!existsSync(metaDir)) return Promise.resolve(sessions);

    for (const file of readdirSync(metaDir)) {
      if (!file.endsWith('.json')) continue;
      let meta: SessionMeta;
      try {
        meta = JSON.parse(readFileSync(resolve(metaDir, file), 'utf-8')) as SessionMeta;
      } catch {
        continue; // skip corrupt files
      }
      const startTime = new Date(meta.start_time);
      const endTime = new Date(startTime.getTime() + meta.duration_minutes * 60000);
      if (endTime < start || startTime > end) continue;

      const totalToolCalls = Object.values(meta.tool_counts).reduce((a, b) => a + b, 0);
      let summary = '';
      let outcome: string | null = null;

      const facetPath = resolve(facetsDir, `${meta.session_id}.json`);
      if (existsSync(facetPath)) {
        try {
          const facet = JSON.parse(readFileSync(facetPath, 'utf-8')) as FacetData;
          summary = facet.brief_summary ?? '';
          outcome = facet.outcome ?? null;
        } catch {
          // skip corrupt facet
        }
      }

      sessions.push({
        sessionId: meta.session_id,
        projectPath: meta.project_path,
        projectName: resolveProjectName(meta.project_path, config),
        toolName: 'claude',
        startTime: meta.start_time,
        endTime: endTime.toISOString(),
        durationMinutes: meta.duration_minutes,
        userMessageCount: meta.user_message_count,
        assistantMessageCount: meta.assistant_message_count,
        totalToolCalls,
        toolErrors: meta.tool_errors,
        tokens: { input: meta.input_tokens, output: meta.output_tokens },
        summary,
        outcome,
        userMessageTimestamps: meta.user_message_timestamps,
        interruptions: meta.user_interruptions,
        autonomousMs: this.estimateAutonomousMs(meta.user_message_timestamps, meta.duration_minutes),
      });
    }
    return Promise.resolve(sessions);
  }

  private estimateAutonomousMs(timestamps: string[], durationMin: number): number {
    if (timestamps.length < 2) return durationMin * 60 * 1000;
    let gaps = 0;
    for (let i = 1; i < timestamps.length; i++) {
      gaps += new Date(timestamps[i]).getTime() - new Date(timestamps[i - 1]).getTime();
    }
    return gaps;
  }
}
