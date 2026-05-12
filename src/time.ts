import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface TimeWindowOptions {
  days?: number;
  week?: string;
}

export interface TimeWindow {
  start: Date;
  end: Date;
}

export function resolveTimeWindow(opts: TimeWindowOptions, now: Date = new Date()): TimeWindow {
  if (opts.week) {
    const monday = dayjs(opts.week).tz('Asia/Shanghai').startOf('day');
    const sunday = monday.add(6, 'day').endOf('day');
    return { start: monday.toDate(), end: sunday.toDate() };
  }
  const days = opts.days ?? 7;
  return {
    start: dayjs(now).subtract(days, 'day').toDate(),
    end: now,
  };
}

export function formatWeekLabel(range: TimeWindow): string {
  const fmt = 'YYYY-MM-DD';
  return `${dayjs(range.start).format(fmt)} ~ ${dayjs(range.end).format(fmt)}`;
}
