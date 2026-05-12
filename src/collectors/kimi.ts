import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Collector } from './interface.js';
import { SessionData, AppConfig } from '../types.js';

interface WireEvent {
  type: string;
  timestamp: number;
  message?: {
    type: string;
    payload: {
      user_input?: string;
      type?: string;
      id?: string;
      think?: string;
      function?: { name: string; arguments: string };
    };
  };
}

const CORRECTION_SIGNALS = ['不对', '错了', '换个思路', '换个方案', '重新', 'no', 'wrong'];

export class KimiCollector implements Collector {
  readonly name = 'kimi';

  constructor(private sessionsDir: string = resolve(process.env.HOME ?? '~', '.kimi', 'sessions')) {}

  collect(start: Date, end: Date, config: AppConfig): Promise<SessionData[]> {
    const sessions: SessionData[] = [];

    if (!existsSync(this.sessionsDir)) return Promise.resolve(sessions);

    for (const hashDir of readdirSync(this.sessionsDir)) {
      const hashPath = resolve(this.sessionsDir, hashDir);
      if (!statSync(hashPath).isDirectory()) continue;

      for (const sidDir of readdirSync(hashPath)) {
        const sidPath = resolve(hashPath, sidDir);
        if (!statSync(sidPath).isDirectory()) continue;

        const wirePath = resolve(sidPath, 'wire.jsonl');
        if (!existsSync(wirePath)) continue;

        let events: WireEvent[];
        try {
          const wireLines = readFileSync(wirePath, 'utf-8').trim().split('\n');
          events = wireLines.map(l => JSON.parse(l));
        } catch {
          continue;
        }

        const timestamps = events.filter(e => e.timestamp).map(e => e.timestamp * 1000);
        if (timestamps.length === 0) continue;

        const sessionStart = new Date(timestamps[0]);
        const sessionEnd = new Date(timestamps[timestamps.length - 1]);

        if (sessionEnd < start || sessionStart > end) continue;

        const userTurns = events.filter(e => e.message?.type === 'TurnBegin');
        const toolCalls = events.filter(e => e.message?.type === 'ToolCall');
        const userMsgs = userTurns.map(t => t.message!.payload.user_input ?? '');
        const firstUserMsg = userMsgs[0] ?? '';

        const interruptions = userMsgs.filter(m =>
          CORRECTION_SIGNALS.some(sig => m.includes(sig))
        ).length;

        const toolTimestamps = toolCalls.map(t => t.timestamp * 1000);
        let autonomousMs = 0;
        for (let i = 1; i < toolTimestamps.length; i++) {
          const gap = toolTimestamps[i] - toolTimestamps[i - 1];
          if (gap < 300000) autonomousMs += gap;
        }

        const durationMs = sessionEnd.getTime() - sessionStart.getTime();
        let summary = firstUserMsg.slice(0, 200);

        const statePath = resolve(sidPath, 'state.json');
        if (existsSync(statePath)) {
          try {
            const state = JSON.parse(readFileSync(statePath, 'utf-8'));
            if (state.custom_title) summary = state.custom_title;
          } catch {
            // skip corrupt state
          }
        }

        sessions.push({
          sessionId: `${hashDir}/${sidDir}`,
          projectPath: 'unknown',
          projectName: 'unknown',
          toolName: 'kimi',
          startTime: sessionStart.toISOString(),
          endTime: sessionEnd.toISOString(),
          durationMinutes: Math.round(durationMs / 60000),
          userMessageCount: userTurns.length,
          assistantMessageCount: events.filter(e => e.message?.type === 'ContentPart').length,
          totalToolCalls: toolCalls.length,
          toolErrors: 0,
          tokens: { input: 0, output: 0 },
          summary,
          outcome: null,
          userMessageTimestamps: userTurns.map(t => new Date(t.timestamp * 1000).toISOString()),
          interruptions,
          autonomousMs,
        });
      }
    }
    return Promise.resolve(sessions);
  }
}
