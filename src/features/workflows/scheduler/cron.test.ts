import { describe, expect, it } from 'vitest';
import { cronMatchesDate, findNextCronAt, parseCronExpression } from './cron';

describe('cron helpers', () => {
  it('parses basic cron expressions', () => {
    expect(parseCronExpression('*/5 * * * *')).not.toBeNull();
    expect(parseCronExpression('0 12 * * 1')).not.toBeNull();
    expect(parseCronExpression('bad value')).toBeNull();
  });

  it('matches dates and finds next run', () => {
    const base = '2026-02-24T10:02:00.000Z';
    const next = findNextCronAt('*/5 * * * *', base);

    expect(next).not.toBeNull();
    expect(cronMatchesDate('*/5 * * * *', new Date(next!))).toBe(true);
  });
});
