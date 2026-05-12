import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppConfig } from './types.js';

export function ensureConfigDir(configDir: string): void {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
}

export function loadConfig(configDir: string): AppConfig {
  const configPath = resolve(configDir, 'config.yaml');
  if (!existsSync(configPath)) {
    return { projects: {} };
  }
  const raw = readFileSync(configPath, 'utf-8');
  return parseSimpleYaml(raw);
}

function parseSimpleYaml(raw: string): AppConfig {
  const projects: Record<string, string> = {};
  let inProjects = false;
  for (const line of raw.split('\n')) {
    if (line.trim() === 'projects:') { inProjects = true; continue; }
    if (!inProjects) continue;
    const match = line.match(/^\s+(.+?):\s*(.+)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      projects[key] = val;
    }
  }
  return { projects };
}

export function resolveProjectName(path: string, config: AppConfig): string {
  return config.projects[path] ?? (path.split('/').pop() || 'unknown');
}
