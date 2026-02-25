import { useMemo } from 'react';
import { renderMarkdownToHtml } from './markdown';

type MarkdownPreviewProps = {
  markdown: string;
  className?: string;
};

export function MarkdownPreview({ markdown, className = '' }: MarkdownPreviewProps) {
  const html = useMemo(() => renderMarkdownToHtml(markdown), [markdown]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
