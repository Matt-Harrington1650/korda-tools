import { useState } from 'react';
import { useSophonStore } from '../../features/sophon/store/sophonStore';

export function SophonRetrievalLabPage() {
  const [query, setQuery] = useState('');
  const runRetrievalTest = useSophonStore((store) => store.runRetrievalTest);
  const lastRetrieval = useSophonStore((store) => store.state.lastRetrieval);
  const tuning = useSophonStore((store) => store.state.tuning);

  const exportReport = (): void => {
    if (!lastRetrieval) {
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
  };

  const exportHumanReport = (): void => {
    if (!lastRetrieval) {
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
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">Retrieval Lab</h3>
      <p className="mt-1 text-sm text-slate-600">
        Query console with explainable passages, scores, citations, and report export.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Ask a question about your indexed knowledge..."
          value={query}
        />
        <button
          className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
          onClick={() => {
            runRetrievalTest(query);
          }}
          type="button"
        >
          Run Test
        </button>
        <button
          className="rounded border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          onClick={exportReport}
          type="button"
        >
          Export Report
        </button>
        <button
          className="rounded border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          onClick={exportHumanReport}
          type="button"
        >
          Export Text
        </button>
      </div>

      {lastRetrieval ? (
        <div className="mt-4 space-y-3">
          <article className="rounded border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs uppercase tracking-wide text-blue-700">Answer</p>
            <p className="mt-1 text-sm text-slate-900">{lastRetrieval.answer}</p>
            <p className="mt-2 text-xs text-slate-600">
              Generated: {new Date(lastRetrieval.generatedAt).toLocaleString()}
            </p>
          </article>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Retrieved Passages</h4>
            <div className="mt-2 space-y-2">
              {lastRetrieval.passages.length === 0 ? (
                <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  No passages. Ingest data first.
                </p>
              ) : null}
              {lastRetrieval.passages.map((passage, index) => (
                <article key={`${passage.sourceName}-${index}`} className="rounded border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">{passage.sourceName}</p>
                  <p className="mt-1 text-xs text-slate-600">Score: {passage.score.toFixed(2)}</p>
                  <p className="mt-2 text-sm text-slate-700">{passage.content}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
