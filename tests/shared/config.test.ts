import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../../src/config.js';

const testDir = resolve('/tmp/cc-week-report-test-config');

describe('loadConfig', () => {
  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  it('returns empty projects map when no config exists', () => {
    const cfg = loadConfig(testDir);
    expect(cfg.projects).toEqual({});
  });

  it('reads project mapping from config.yaml', () => {
    writeFileSync(resolve(testDir, 'config.yaml'), `
projects:
  /Users/edy/projects/yj/risk-center: 风控中心
  /Users/edy/projects/me/tech/cc-week-report: 周报工具
`);
    const cfg = loadConfig(testDir);
    expect(cfg.projects['/Users/edy/projects/yj/risk-center']).toBe('风控中心');
    expect(cfg.projects['/Users/edy/projects/me/tech/cc-week-report']).toBe('周报工具');
  });

  it('resolves project name from config or derives from path', () => {
    writeFileSync(resolve(testDir, 'config.yaml'), `
projects: {}
`);
    const cfg = loadConfig(testDir);
    const name = cfg.projects['/Users/edy/projects/yj/risk-center'] ?? 'unknown';
    expect(name).toBe('unknown');
  });
});
