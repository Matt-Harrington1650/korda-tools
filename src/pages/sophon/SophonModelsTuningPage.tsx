import { useSophonStore } from '../../features/sophon/store/sophonStore';

const EMBEDDING_MODEL_OPTIONS = [
  { value: 'nvidia/llama-3.2-nv-embedqa-1b-v2', label: 'Llama 3.2 EmbedQA 1B v2' },
  { value: 'nvidia/nv-embedqa-e5-v5', label: 'NV EmbedQA E5 v5' },
  { value: 'nvidia/nv-embed-v1', label: 'NV Embed v1' },
] as const;

const TOP_K_OPTIONS = [5, 10, 20, 30, 50] as const;
const CONTEXT_WINDOW_OPTIONS = [8192, 16384, 32768, 65536] as const;
const RESPONSE_TOKEN_OPTIONS = [512, 1024, 2048, 4096, 8192] as const;
const INGESTION_WORKER_OPTIONS = [1, 2, 4, 8, 16] as const;

export function SophonModelsTuningPage() {
  const tuning = useSophonStore((store) => store.state.tuning);
  const updateTuning = useSophonStore((store) => store.updateTuning);
  const embeddingModelOptions = EMBEDDING_MODEL_OPTIONS.some((option) => option.value === tuning.embeddingModel)
    ? EMBEDDING_MODEL_OPTIONS
    : [...EMBEDDING_MODEL_OPTIONS, { value: tuning.embeddingModel, label: `${tuning.embeddingModel} (Current)` }];

  return (
    <section className="kt-panel p-4">
      <h3 className="kt-title-lg">Models & Tuning</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="kt-title-sm">Embedding Model</span>
          <select
            className="kt-select"
            onChange={(event) => {
              updateTuning({ embeddingModel: event.target.value });
            }}
            value={tuning.embeddingModel}
          >
            {embeddingModelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="kt-title-sm">Retriever Top-K</span>
          <select
            className="kt-select"
            onChange={(event) => {
              updateTuning({ retrieverTopK: Number(event.target.value) });
            }}
            value={tuning.retrieverTopK}
          >
            {TOP_K_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="kt-title-sm">Score Threshold</span>
          <input
            className="kt-input"
            max={1}
            min={0}
            onChange={(event) => {
              updateTuning({ scoreThreshold: Number(event.target.value) });
            }}
            step={0.05}
            type="range"
            value={tuning.scoreThreshold}
          />
          <p className="text-xs text-[color:var(--kt-text-muted)]">{tuning.scoreThreshold.toFixed(2)}</p>
        </label>
        <label className="space-y-1">
          <span className="kt-title-sm">Reranker Threshold</span>
          <input
            className="kt-input"
            max={1}
            min={0}
            onChange={(event) => {
              updateTuning({ rerankerThreshold: Number(event.target.value) });
            }}
            step={0.05}
            type="range"
            value={tuning.rerankerThreshold}
          />
          <p className="text-xs text-[color:var(--kt-text-muted)]">{tuning.rerankerThreshold.toFixed(2)}</p>
        </label>
        <label className="space-y-1">
          <span className="kt-title-sm">Context Window Tokens</span>
          <select
            className="kt-select"
            onChange={(event) => {
              updateTuning({ contextWindowTokens: Number(event.target.value) });
            }}
            value={tuning.contextWindowTokens}
          >
            {CONTEXT_WINDOW_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="kt-title-sm">Response Max Tokens</span>
          <select
            className="kt-select"
            onChange={(event) => {
              updateTuning({ responseMaxTokens: Number(event.target.value) });
            }}
            value={tuning.responseMaxTokens}
          >
            {RESPONSE_TOKEN_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="kt-title-sm">Max Ingestion Workers</span>
          <select
            className="kt-select"
            onChange={(event) => {
              updateTuning({ maxIngestionWorkers: Number(event.target.value) });
            }}
            value={tuning.maxIngestionWorkers}
          >
            {INGESTION_WORKER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="kt-panel-muted flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--kt-text-secondary)]">
          <input
            className="kt-checkbox"
            checked={tuning.rerankerEnabled}
            onChange={(event) => {
              updateTuning({ rerankerEnabled: event.target.checked });
            }}
            type="checkbox"
          />
          Enable reranker
        </label>
        <label className="kt-panel-muted flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--kt-text-secondary)]">
          <input
            className="kt-checkbox"
            checked={tuning.explainRetrieval}
            onChange={(event) => {
              updateTuning({ explainRetrieval: event.target.checked });
            }}
            type="checkbox"
          />
          Explain retrieval by default
        </label>
        <label className="kt-panel-muted flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--kt-text-secondary)]">
          <input
            className="kt-checkbox"
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
