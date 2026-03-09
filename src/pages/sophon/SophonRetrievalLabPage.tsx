import { useState } from 'react';
import { useSophonStore } from '../../features/sophon/store/sophonStore';

export function SophonRetrievalLabPage() {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const runRetrievalTest = useSophonStore((store) => store.runRetrievalTest);
  const lastRetrieval = useSophonStore((store) => store.state.lastRetrieval);
  const tuning = useSophonStore((store) => store.state.tuning);

  const exportReport = (): void => {
    if (!lastRetrieval) {
      setMessage('Run a retrieval test before exporting a report.');
      return;
    }

    const report = {
      generatedAt: new Date().toISOString(),
      module: 'Sophon Retrieval Lab',
      tuning,
      result: lastRetrieval,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sophon-retrieval-report-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('JSON report exported.');
  };

  const exportHumanReport = (): void => {
    if (!lastRetrieval) {
      setMessage('Run a retrieval test before exporting a text report.');
      return;
    }
    const lines = [
      `Sophon Retrieval Report`,
      `Generated: ${new Date().toISOString()}`,
      `Query: ${lastRetrieval.query}`,
      `Answer: ${lastRetrieval.answer}`,
      ``,
      `Passages:`,
      ...lastRetrieval.passages.map(
        (passage, index) =>
          `${index + 1}. ${passage.sourceName} (score=${passage.score.toFixed(2)})\n   ${passage.content}`,
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sophon-retrieval-report-${Date.now()}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('Text report exported.');
  };

  return (
    <section className="kt-panel p-4">
      <h3 className="kt-title-lg">Retrieval Lab</h3>
      <p className="mt-1 text-sm text-[color:var(--kt-text-secondary)]">
        Query console with explainable passages, scores, citations, and report export.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className="kt-input flex-1"
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Ask a question about your indexed knowledge..."
          value={query}
        />
        <button
          className="kt-btn kt-btn-primary"
          onClick={() => {
            const trimmed = query.trim();
            if (!trimmed) {
              setMessage('Enter a question before running retrieval.');
              return;
            }
            runRetrievalTest(trimmed);
            setMessage('Retrieval test submitted.');
          }}
          type="button"
        >
          Run Test
        </button>
        <button
          className="kt-btn kt-btn-secondary"
          onClick={exportReport}
          type="button"
        >
          Export Report
        </button>
        <button
          className="kt-btn kt-btn-secondary"
          onClick={exportHumanReport}
          type="button"
        >
          Export Text
        </button>
      </div>
      {message ? <p className="mt-2 text-xs text-[color:var(--kt-text-muted)]">{message}</p> : null}

      {lastRetrieval ? (
        <div className="mt-4 space-y-3">
          <article className="kt-panel-muted border-blue-400/40 p-3">
            <p className="kt-title-sm text-[color:var(--kt-accent-hover)]">Answer</p>
            <p className="mt-1 text-sm text-[color:var(--kt-text-primary)]">{lastRetrieval.answer}</p>
            <p className="mt-2 text-xs text-[color:var(--kt-text-muted)]">
              Generated: {new Date(lastRetrieval.generatedAt).toLocaleString()}
            </p>
          </article>
          <div>
            <h4 className="text-sm font-semibold text-[color:var(--kt-text-primary)]">Retrieved Passages</h4>
            <div className="mt-2 space-y-2">
              {lastRetrieval.passages.length === 0 ? (
                <p className="kt-panel-muted border-dashed px-3 py-2 text-sm text-[color:var(--kt-text-muted)]">
                  No passages. Ingest data first.
                </p>
              ) : null}
              {lastRetrieval.passages.map((passage, index) => (
                <article key={`${passage.sourceName}-${index}`} className="kt-panel-muted p-3">
                  <p className="text-sm font-semibold text-[color:var(--kt-text-primary)]">{passage.sourceName}</p>
                  <p className="mt-1 text-xs text-[color:var(--kt-text-muted)]">Score: {passage.score.toFixed(2)}</p>
                  <p className="mt-2 text-sm text-[color:var(--kt-text-secondary)]">{passage.content}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
