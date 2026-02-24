import { describe, expect, it } from 'vitest';
import { redactHeaders, redactText } from './logRedaction';

describe('logRedaction', () => {
  it('redacts all header values', () => {
    const headers = redactHeaders({
      Authorization: 'Bearer super-secret-token',
      'X-Custom': 'abc123',
    });

    expect(headers).toEqual({
      Authorization: '[REDACTED]',
      'X-Custom': '[REDACTED]',
    });
  });

  it('redacts secret-like values in payload text', () => {
    const payload = `{"token":"top-secret","note":"safe"} Authorization: Bearer abc.def`;
    const redacted = redactText(payload);

    expect(redacted).not.toContain('top-secret');
    expect(redacted).not.toContain('abc.def');
    expect(redacted).toContain('[REDACTED]');
  });
});
