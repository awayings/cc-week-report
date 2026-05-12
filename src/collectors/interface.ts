import { SessionData, AppConfig } from '../types.js';

export interface Collector {
  readonly name: string;
  collect(start: Date, end: Date, config: AppConfig): Promise<SessionData[]>;
}
