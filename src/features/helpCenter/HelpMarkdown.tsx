import { useEffect, useMemo, useRef, useState } from 'react';
import { parseHelpLink } from './helpLinks';
import { highlightSearchMatches, renderHelpMarkdown } from './markdown';

type HelpMarkdownProps = {
  markdown: string;
  inPageSearch: string;
  activeAnchor?: string;
  onNavigateHelpLink: (slug: string, anchor?: string) => void;
  onInPageMatchCountChange: (count: number) => void;
  className?: string;
};

export function HelpMarkdown({
  markdown,
  inPageSearch,
  activeAnchor,
  onNavigateHelpLink,
  onInPageMatchCountChange,
  className = '',
}: HelpMarkdownProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const html = useMemo(() => renderHelpMarkdown(markdown), [markdown]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleClick = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const copyButton = target.closest<HTMLButtonElement>('button[data-copy-code]');
      if (copyButton) {
        event.preventDefault();
        const payload = copyButton.getAttribute('data-copy-code');
        if (!payload) {
          return;
        }

        void navigator.clipboard
          .writeText(decodeURIComponent(payload))
          .then(() => {
            setCopyMessage('Code copied');
          })
          .catch(() => {
            setCopyMessage('Clipboard denied');
          });
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>('a[data-help-link="true"]');
      if (!anchor) {
        return;
      }

      const href = anchor.getAttribute('href') ?? '';
      const parsed = parseHelpLink(href);
      if (!parsed) {
        return;
      }

      event.preventDefault();
      onNavigateHelpLink(parsed.slug, parsed.anchor);
    };

    container.addEventListener('click', handleClick);
    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, [onNavigateHelpLink]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const matchCount = highlightSearchMatches(container, inPageSearch);
    onInPageMatchCountChange(matchCount);

    if (activeAnchor) {
      const anchorTarget = container.querySelector<HTMLElement>(`[id="${activeAnchor}"]`);
      if (anchorTarget) {
        anchorTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    if (inPageSearch.trim() && matchCount > 0) {
      const firstMatch = container.querySelector<HTMLElement>('mark[data-help-highlight="true"]');
      firstMatch?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeAnchor, html, inPageSearch, onInPageMatchCountChange]);

  useEffect(() => {
    if (!copyMessage) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCopyMessage('');
    }, 1500);
    return () => {
      window.clearTimeout(timer);
    };
  }, [copyMessage]);

  return (
    <div className={`space-y-3 ${className}`}>
      {copyMessage ? <p className="text-xs text-emerald-700">{copyMessage}</p> : null}
      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
