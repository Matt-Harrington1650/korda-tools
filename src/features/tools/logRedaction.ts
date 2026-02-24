const REDACTED = '[REDACTED]';

export const redactHeaders = (headers: Record<string, string>): Record<string, string> => {
  return Object.keys(headers).reduce<Record<string, string>>((accumulator, key) => {
    accumulator[key] = REDACTED;
    return accumulator;
  }, {});
};

export const redactText = (value: string): string => {
  if (!value) {
    return '';
  }

  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/"(api[_-]?key|token|secret|password)"\s*:\s*"[^"]*"/gi, '"$1":"[REDACTED]"');
};
