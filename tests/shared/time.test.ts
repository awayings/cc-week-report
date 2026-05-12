import { describe, it, expect } from 'vitest';
import { resolveTimeWindow, formatWeekLabel } from '../../src/time.js';

describe('resolveTimeWindow', () => {
  it('defaults to past 7 days', () => {
    const now = new Date('2026-05-12T15:30:00Z');
    const result = resolveTimeWindow({}, now);
    expect(result.start.toISOString()).toBe('2026-05-05T15:30:00.000Z');
    expect(result.end.toISOString()).toBe('2026-05-12T15:30:00.000Z');
  });

  it('accepts --days N', () => {
    const now = new Date('2026-05-12T15:30:00Z');
    const result = resolveTimeWindow({ days: 3 }, now);
    expect(result.start.toISOString()).toBe('2026-05-09T15:30:00.000Z');
  });

  it('accepts --week for natural week (Mon 00:00 ~ Sun 23:59)', () => {
    // 2026-05-04 is a Monday
    // Asia/Shanghai = UTC+8, so 2026-05-04T00:00:00+08:00 = 2026-05-03T16:00:00Z
    const result = resolveTimeWindow({ week: '2026-05-04' });
    expect(result.start.toISOString()).toBe('2026-05-03T16:00:00.000Z');
    expect(result.end.toISOString()).toBe('2026-05-10T15:59:59.999Z');
  });

  it('formatWeekLabel returns Shanghai-local dates', () => {
    const start = new Date('2026-05-03T16:00:00.000Z'); // Mon 00:00 Shanghai
    const end = new Date('2026-05-10T15:59:59.999Z');   // Sun 23:59 Shanghai
    const label = formatWeekLabel({ start, end });
    expect(label).toBe('2026-05-04 ~ 2026-05-10');
  });
});
