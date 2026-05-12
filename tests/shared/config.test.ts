import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, resolveProjectName, ensureConfigDir } from '../../src/config.js';

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

  it('resolveProjectName returns display name from config', () => {
    writeFileSync(resolve(testDir, 'config.yaml'), `
projects:
  /some/project: My Project
`);
    const cfg = loadConfig(testDir);
    expect(resolveProjectName('/some/project', cfg)).toBe('My Project');
  });

  it('resolveProjectName falls back to last path segment when not in config', () => {
    const cfg = loadConfig(testDir);
    expect(resolveProjectName('/some/project', cfg)).toBe('project');
  });
});

describe('ensureConfigDir', () => {
  const dir = resolve('/tmp/cc-week-report-test-ensure-dir');

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates directory if missing', () => {
    expect(() => ensureConfigDir(dir)).not.toThrow();
  });

  it('is no-op when directory exists', () => {
    mkdirSync(dir, { recursive: true });
    expect(() => ensureConfigDir(dir)).not.toThrow();
  });
});
