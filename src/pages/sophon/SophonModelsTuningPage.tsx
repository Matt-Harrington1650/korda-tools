import type { ChangeEvent } from 'react';
import { useSophonStore } from '../../features/sophon/store/sophonStore';

export function SophonModelsTuningPage() {
  const tuning = useSophonStore((store) => store.state.tuning);
  const updateTuning = useSophonStore((store) => store.updateTuning);

  const onNumber =
    (
      field:
        | 'retrieverTopK'
        | 'rerankerThreshold'
        | 'scoreThreshold'
        | 'contextWindowTokens'
        | 'responseMaxTokens'
        | 'maxIngestionWorkers',
    ) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      const value = Number(event.target.value);
      if (!Number.isFinite(value)) {
        return;
      }
      updateTuning({ [field]: value } as Partial<typeof tuning>);
    };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">Models & Tuning</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase text-slate-600">Embedding Model</span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => {
              updateTuning({ embeddingModel: event.target.value });
            }}
            value={tuning.embeddingModel}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase text-slate-600">Retriever Top-K</span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            min={1}
            onChange={onNumber('retrieverTopK')}
            type="number"
            value={tuning.retrieverTopK}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase text-slate-600">Score Threshold</span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            max={1}
            min={0}
            onChange={onNumber('scoreThreshold')}
            step={0.01}
            type="number"
            value={tuning.scoreThreshold}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase text-slate-600">Reranker Threshold</span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            max={1}
            min={0}
            onChange={onNumber('rerankerThreshold')}
            step={0.01}
            type="number"
            value={tuning.rerankerThreshold}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase text-slate-600">Context Window Tokens</span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            min={1024}
            onChange={onNumber('contextWindowTokens')}
            type="number"
            value={tuning.contextWindowTokens}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase text-slate-600">Response Max Tokens</span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            min={64}
            onChange={onNumber('responseMaxTokens')}
            type="number"
            value={tuning.responseMaxTokens}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase text-slate-600">Max Ingestion Workers</span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            min={1}
            onChange={onNumber('maxIngestionWorkers')}
            type="number"
            value={tuning.maxIngestionWorkers}
          />
        </label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <input
            checked={tuning.rerankerEnabled}
            onChange={(event) => {
              updateTuning({ rerankerEnabled: event.target.checked });
            }}
            type="checkbox"
          />
          Enable reranker
        </label>
        <label className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <input
            checked={tuning.explainRetrieval}
            onChange={(event) => {
              updateTuning({ explainRetrieval: event.target.checked });
            }}
            type="checkbox"
          />
          Explain retrieval by default
        </label>
        <label className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <input
            checked={tuning.forceCpuOnly}
            onChange={(event) => {
              updateTuning({ forceCpuOnly: event.target.checked });
            }}
            type="checkbox"
          />
          Force CPU only
        </label>
      </div>
    </section>
  );
}
