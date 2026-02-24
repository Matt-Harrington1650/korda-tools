type CronField = {
  allows: (value: number) => boolean;
};

const parsePart = (part: string, min: number, max: number): CronField | null => {
  const trimmed = part.trim();
  if (trimmed === '*') {
    return { allows: () => true };
  }

  if (trimmed.startsWith('*/')) {
    const interval = Number(trimmed.slice(2));
    if (!Number.isInteger(interval) || interval <= 0) {
      return null;
    }

    return {
      allows: (value) => (value - min) % interval === 0,
    };
  }

  const values = trimmed
    .split(',')
    .map((token) => Number(token.trim()))
    .filter((value) => Number.isInteger(value) && value >= min && value <= max);

  if (values.length === 0) {
    return null;
  }

  const allowed = new Set(values);
  return {
    allows: (value) => allowed.has(value),
  };
};

type ParsedCron = {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
};

export const parseCronExpression = (expression: string): ParsedCron | null => {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }

  const minute = parsePart(parts[0], 0, 59);
  const hour = parsePart(parts[1], 0, 23);
  const dayOfMonth = parsePart(parts[2], 1, 31);
  const month = parsePart(parts[3], 1, 12);
  const dayOfWeek = parsePart(parts[4], 0, 6);

  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
    return null;
  }

  return {
    minute,
    hour,
    dayOfMonth,
    month,
    dayOfWeek,
  };
};

export const cronMatchesDate = (expression: string, date: Date): boolean => {
  const parsed = parseCronExpression(expression);
  if (!parsed) {
    return false;
  }

  return (
    parsed.minute.allows(date.getMinutes()) &&
    parsed.hour.allows(date.getHours()) &&
    parsed.dayOfMonth.allows(date.getDate()) &&
    parsed.month.allows(date.getMonth() + 1) &&
    parsed.dayOfWeek.allows(date.getDay())
  );
};

export const findNextCronAt = (
  expression: string,
  baseIso: string,
  searchWindowMinutes = 31 * 24 * 60,
): string | null => {
  const parsed = parseCronExpression(expression);
  if (!parsed) {
    return null;
  }

  const cursor = new Date(baseIso);
  cursor.setSeconds(0, 0);

  for (let index = 1; index <= searchWindowMinutes; index += 1) {
    const probe = new Date(cursor.getTime() + index * 60_000);
    if (
      parsed.minute.allows(probe.getMinutes()) &&
      parsed.hour.allows(probe.getHours()) &&
      parsed.dayOfMonth.allows(probe.getDate()) &&
      parsed.month.allows(probe.getMonth() + 1) &&
      parsed.dayOfWeek.allows(probe.getDay())
    ) {
      return probe.toISOString();
    }
  }

  return null;
};
