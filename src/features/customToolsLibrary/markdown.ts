const escapeHtml = (value: string): string => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

const applyInline = (value: string): string => {
  return value
    .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1 py-0.5 text-xs">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
};

export const renderMarkdownToHtml = (markdown: string): string => {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let inList = false;

  const closeList = (): void => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  lines.forEach((rawLine) => {
    const safe = applyInline(escapeHtml(rawLine.trim()));
    if (!safe) {
      closeList();
      return;
    }

    if (safe.startsWith('### ')) {
      closeList();
      html.push(`<h3 class="mt-4 text-base font-semibold text-slate-900">${safe.slice(4)}</h3>`);
      return;
    }

    if (safe.startsWith('## ')) {
      closeList();
      html.push(`<h2 class="mt-4 text-lg font-semibold text-slate-900">${safe.slice(3)}</h2>`);
      return;
    }

    if (safe.startsWith('# ')) {
      closeList();
      html.push(`<h1 class="mt-4 text-xl font-semibold text-slate-900">${safe.slice(2)}</h1>`);
      return;
    }

    if (safe.startsWith('- ')) {
      if (!inList) {
        html.push('<ul class="mt-2 list-disc space-y-1 pl-6 text-sm text-slate-700">');
        inList = true;
      }
      html.push(`<li>${safe.slice(2)}</li>`);
      return;
    }

    closeList();
    html.push(`<p class="mt-2 text-sm leading-6 text-slate-700">${safe}</p>`);
  });

  closeList();
  return html.join('');
};
