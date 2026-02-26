import { describe, expect, it } from 'vitest';
import { parseHelpLink, toHelpRoute } from './helpLinks';

describe('helpLinks', () => {
  it('parses help protocol links', () => {
    expect(parseHelpLink('help://quick-start')).toEqual({
      slug: 'quick-start',
      anchor: undefined,
    });

    expect(parseHelpLink('help://workflows-overview#Add a Custom Tool')).toEqual({
      slug: 'workflows-overview',
      anchor: 'add-a-custom-tool',
    });
  });

  it('rejects invalid help links', () => {
    expect(parseHelpLink('https://example.com')).toBeNull();
    expect(parseHelpLink('help://')).toBeNull();
    expect(parseHelpLink('help://bad slug')).toBeNull();
  });

  it('maps parsed targets to app routes', () => {
    expect(
      toHelpRoute({
        slug: 'quick-start',
      }),
    ).toBe('/help/quick-start');
    expect(
      toHelpRoute({
        slug: 'workflows-overview',
        anchor: 'Add a Custom Tool',
      }),
    ).toBe('/help/workflows-overview#add-a-custom-tool');
  });
});
