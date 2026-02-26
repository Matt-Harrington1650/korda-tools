export type HelpLinkTarget = {
  slug: string;
  anchor?: string;
};

const HELP_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugifyHelpFragment = (value: string): string => {
  const lowered = value.trim().toLowerCase();
  let output = '';
  let previousDash = false;

  for (const character of lowered) {
    if ((character >= 'a' && character <= 'z') || (character >= '0' && character <= '9')) {
      output += character;
      previousDash = false;
      continue;
    }

    if (!previousDash) {
      output += '-';
      previousDash = true;
    }
  }

  output = output.replace(/^-+|-+$/g, '');
  return output;
};

export const parseHelpLink = (href: string): HelpLinkTarget | null => {
  const trimmed = href.trim();
  if (!trimmed.startsWith('help://')) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const slugCandidate = `${parsed.hostname}${parsed.pathname}`.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (!HELP_SLUG_PATTERN.test(slugCandidate)) {
      return null;
    }

    const anchorCandidate = decodeURIComponent(parsed.hash.replace(/^#/, ''));
    const anchor = anchorCandidate ? slugifyHelpFragment(anchorCandidate) : undefined;

    return {
      slug: slugCandidate,
      anchor: anchor || undefined,
    };
  } catch {
    return null;
  }
};

export const toHelpRoute = (target: HelpLinkTarget): string => {
  const anchor = target.anchor ? `#${slugifyHelpFragment(target.anchor)}` : '';
  return `/help/${target.slug}${anchor}`;
};
