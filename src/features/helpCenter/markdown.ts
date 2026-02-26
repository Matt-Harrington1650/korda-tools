import { parseHelpLink, slugifyHelpFragment } from './helpLinks';

const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
const FENCE_PATTERN = /^```([\w-]+)?\s*$/;
const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;
const UNORDERED_PATTERN = /^[-*]\s+(.+)$/;
const ORDERED_PATTERN = /^\d+\.\s+(.+)$/;

const escapeHtml = (value: string): string => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

const normalizeExternalHref = (value: string): string | null => {
  const trimmed = value.trim();
  if (trimmed.startsWith('#')) {
    const anchor = slugifyHelpFragment(trimmed.slice(1));
    return anchor ? `#${anchor}` : '#';
  }

  if (trimmed.startsWith('help://')) {
    return parseHelpLink(trimmed) ? trimmed : null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
};

const applyInlineFormatting = (value: string): string => {
  const codeTokens: string[] = [];
  const withCode = value.replace(/`([^`]+)`/g, (_match, code: string) => {
    const token = `%%CODE_TOKEN_${codeTokens.length}%%`;
    codeTokens.push(`<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-800">${code}</code>`);
    return token;
  });
  const withBold = withCode.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
  return codeTokens.reduce((current, token, index) => {
    return current.replaceAll(`%%CODE_TOKEN_${index}%%`, token);
  }, withBold);
};

const renderInline = (value: string): string => {
  const output: string[] = [];
  let cursor = 0;
  LINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = LINK_PATTERN.exec(value);

  while (match) {
    const [fullMatch, label, hrefRaw] = match;
    const before = value.slice(cursor, match.index);
    output.push(applyInlineFormatting(escapeHtml(before)));

    const href = normalizeExternalHref(hrefRaw);
    if (!href) {
      output.push(applyInlineFormatting(escapeHtml(fullMatch)));
    } else if (href.startsWith('help://')) {
      output.push(
        `<a class="text-slate-900 underline decoration-slate-400 underline-offset-2 hover:decoration-slate-800" href="${escapeHtml(href)}" data-help-link="true">${applyInlineFormatting(escapeHtml(label))}</a>`,
      );
    } else {
      output.push(
        `<a class="text-slate-900 underline decoration-slate-400 underline-offset-2 hover:decoration-slate-800" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${applyInlineFormatting(escapeHtml(label))}</a>`,
      );
    }

    cursor = match.index + fullMatch.length;
    match = LINK_PATTERN.exec(value);
  }

  output.push(applyInlineFormatting(escapeHtml(value.slice(cursor))));
  LINK_PATTERN.lastIndex = 0;
  return output.join('');
};

const splitTableRow = (line: string): string[] => {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
};

const isTableDelimiter = (line: string): boolean => {
  if (!line.includes('|')) {
    return false;
  }
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
};

const isTableHeaderStart = (line: string, nextLine: string | undefined): boolean => {
  if (!line.includes('|') || !nextLine) {
    return false;
  }
  const headerCells = splitTableRow(line);
  return headerCells.length > 0 && isTableDelimiter(nextLine);
};

const isBoundaryLine = (line: string, nextLine: string | undefined): boolean => {
  if (!line.trim()) {
    return true;
  }
  if (FENCE_PATTERN.test(line.trim())) {
    return true;
  }
  if (HEADING_PATTERN.test(line.trim())) {
    return true;
  }
  if (UNORDERED_PATTERN.test(line.trim()) || ORDERED_PATTERN.test(line.trim())) {
    return true;
  }
  return isTableHeaderStart(line, nextLine);
};

export const renderHelpMarkdown = (markdown: string): string => {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const html: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fenceMatch = trimmed.match(FENCE_PATTERN);
    if (fenceMatch) {
      const language = fenceMatch[1] ?? 'text';
      const blockLines: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE_PATTERN.test((lines[index] ?? '').trim())) {
        blockLines.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length && FENCE_PATTERN.test((lines[index] ?? '').trim())) {
        index += 1;
      }

      const code = blockLines.join('\n');
      html.push(
        `<section class="my-4 overflow-hidden rounded-md border border-slate-200 bg-slate-950 text-slate-100">
          <header class="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-xs">
            <span class="font-medium uppercase tracking-wide text-slate-300">${escapeHtml(language)}</span>
            <button type="button" class="rounded border border-slate-600 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800" data-copy-code="${encodeURIComponent(code)}">Copy</button>
          </header>
          <pre class="max-h-[420px] overflow-auto p-3 text-xs leading-6"><code>${escapeHtml(code)}</code></pre>
        </section>`,
      );
      continue;
    }

    const headingMatch = trimmed.match(HEADING_PATTERN);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const anchorId = slugifyHelpFragment(headingText);
      const sizeClass =
        level === 1
          ? 'text-2xl'
          : level === 2
            ? 'text-xl'
            : level === 3
              ? 'text-lg'
              : 'text-base';
      const tag = `h${Math.min(level, 6)}`;
      const idAttribute = anchorId ? ` id="${anchorId}"` : '';
      html.push(`<${tag}${idAttribute} class="mt-5 ${sizeClass} font-semibold text-slate-900">${renderInline(headingText)}</${tag}>`);
      index += 1;
      continue;
    }

    if (isTableHeaderStart(line, lines[index + 1])) {
      const headerCells = splitTableRow(line);
      index += 2;
      const bodyRows: string[][] = [];
      while (index < lines.length) {
        const tableLine = (lines[index] ?? '').trim();
        if (!tableLine || !tableLine.includes('|')) {
          break;
        }
        bodyRows.push(splitTableRow(tableLine));
        index += 1;
      }

      const headHtml = headerCells
        .map((cell) => `<th class="border border-slate-200 bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">${renderInline(cell)}</th>`)
        .join('');
      const rowsHtml = bodyRows
        .map((row) => {
          const padded = [...row];
          while (padded.length < headerCells.length) {
            padded.push('');
          }
          return `<tr>${padded
            .slice(0, headerCells.length)
            .map((cell) => `<td class="border border-slate-200 px-3 py-2 align-top text-sm text-slate-700">${renderInline(cell)}</td>`)
            .join('')}</tr>`;
        })
        .join('');

      html.push(
        `<div class="my-4 overflow-x-auto"><table class="min-w-full border-collapse"><thead><tr>${headHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`,
      );
      continue;
    }

    if (UNORDERED_PATTERN.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length) {
        const listLine = (lines[index] ?? '').trim();
        const itemMatch = listLine.match(UNORDERED_PATTERN);
        if (!itemMatch) {
          break;
        }
        items.push(`<li>${renderInline(itemMatch[1])}</li>`);
        index += 1;
      }
      html.push(`<ul class="my-3 list-disc space-y-1 pl-6 text-sm text-slate-700">${items.join('')}</ul>`);
      continue;
    }

    if (ORDERED_PATTERN.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length) {
        const listLine = (lines[index] ?? '').trim();
        const itemMatch = listLine.match(ORDERED_PATTERN);
        if (!itemMatch) {
          break;
        }
        items.push(`<li>${renderInline(itemMatch[1])}</li>`);
        index += 1;
      }
      html.push(`<ol class="my-3 list-decimal space-y-1 pl-6 text-sm text-slate-700">${items.join('')}</ol>`);
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const paragraphLine = lines[index] ?? '';
      if (isBoundaryLine(paragraphLine, lines[index + 1])) {
        break;
      }
      paragraphLines.push(paragraphLine.trim());
      index += 1;
    }
    if (paragraphLines.length === 0) {
      paragraphLines.push(trimmed);
      index += 1;
    }
    html.push(`<p class="my-3 text-sm leading-6 text-slate-700">${renderInline(paragraphLines.join(' '))}</p>`);
  }

  return html.join('');
};

const clearHighlights = (container: HTMLElement): void => {
  const highlights = container.querySelectorAll('mark[data-help-highlight="true"]');
  highlights.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) {
      return;
    }
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
    parent.normalize();
  });
};

export const highlightSearchMatches = (container: HTMLElement, query: string): number => {
  clearHighlights(container);

  const trimmed = query.trim();
  if (!trimmed) {
    return 0;
  }

  const needle = trimmed.toLowerCase();
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const value = node.nodeValue ?? '';
      if (!value.trim()) {
        return NodeFilter.FILTER_REJECT;
      }

      const parent = node.parentElement;
      if (!parent) {
        return NodeFilter.FILTER_REJECT;
      }

      if (parent.closest('pre, code, button')) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  let totalMatches = 0;
  for (const textNode of textNodes) {
    const original = textNode.nodeValue ?? '';
    const lowered = original.toLowerCase();
    if (!lowered.includes(needle)) {
      continue;
    }

    const fragment = document.createDocumentFragment();
    let startIndex = 0;
    let matchIndex = lowered.indexOf(needle, startIndex);
    while (matchIndex >= 0) {
      if (matchIndex > startIndex) {
        fragment.appendChild(document.createTextNode(original.slice(startIndex, matchIndex)));
      }

      const mark = document.createElement('mark');
      mark.setAttribute('data-help-highlight', 'true');
      mark.className = 'rounded bg-amber-200 px-0.5';
      mark.textContent = original.slice(matchIndex, matchIndex + needle.length);
      fragment.appendChild(mark);

      totalMatches += 1;
      startIndex = matchIndex + needle.length;
      matchIndex = lowered.indexOf(needle, startIndex);
    }

    if (startIndex < original.length) {
      fragment.appendChild(document.createTextNode(original.slice(startIndex)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  return totalMatches;
};
