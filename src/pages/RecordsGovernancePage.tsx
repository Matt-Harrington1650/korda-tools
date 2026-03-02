import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFileService, type RunAttachment } from '../desktop';
import type { AuditRecord } from '../services/audit/AuditService';
import type {
  ArtifactSummary,
  DeliverableSummary,
  DeliverableVersionSummary,
  GovernanceScope,
  PolicyOverrideSummary,
  ProjectRole,
  ProjectRoleBindingSummary,
  SensitivityLevel,
} from '../features/records/RecordsGovernanceService';
import { recordsGovernanceService } from '../features/records/service';
import { toAppErrorMessage } from '../features/records/RecordsGovernanceService';

const fileService = createFileService();

const defaultScope: GovernanceScope = {
  workspaceId: 'workspace-default',
  projectId: 'project-default',
  actorId: 'actor-local-user',
};

const artifactTypeOptions = [
  'issued_drawing',
  'spec',
  'calculation',
  'rfi',
  'submittal',
  'meeting_minutes',
  'email',
  'ai_output',
] as const;

const statusOptions = ['Draft', 'Issued', 'IFC', 'IFP', 'Superseded', 'AsBuilt'] as const;
const disciplineOptions = ['General', 'Electrical', 'Mechanical', 'FP', 'Architectural', 'Structural'] as const;
const sensitivityOptions: SensitivityLevel[] = ['Public', 'Internal', 'Confidential', 'Client-Confidential'];
const projectRoleOptions: ProjectRole[] = ['project_owner', 'records_publisher', 'records_viewer', 'ai_operator'];

type VersionDraft = {
  artifactId: string;
  reason: string;
};

export function RecordsGovernancePage() {
  const [scope, setScope] = useState<GovernanceScope>(defaultScope);
  const [artifactType, setArtifactType] = useState<string>(artifactTypeOptions[0]);
  const [discipline, setDiscipline] = useState<string>(disciplineOptions[0]);
  const [status, setStatus] = useState<string>(statusOptions[0]);
  const [sensitivityLevel, setSensitivityLevel] = useState<SensitivityLevel>('Internal');
  const [selectedFile, setSelectedFile] = useState<RunAttachment | null>(null);

  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableSummary[]>([]);
  const [deliverableVersions, setDeliverableVersions] = useState<Record<string, DeliverableVersionSummary[]>>({});
  const [auditEvents, setAuditEvents] = useState<AuditRecord[]>([]);
  const [projectRoles, setProjectRoles] = useState<ProjectRoleBindingSummary[]>([]);
  const [policyOverrides, setPolicyOverrides] = useState<PolicyOverrideSummary[]>([]);
  const [versionDrafts, setVersionDrafts] = useState<Record<string, VersionDraft>>({});
  const [grantRoleActorId, setGrantRoleActorId] = useState(defaultScope.actorId);
  const [grantRoleValue, setGrantRoleValue] = useState<ProjectRole>('records_publisher');
  const [overrideActorId, setOverrideActorId] = useState(defaultScope.actorId);
  const [overrideProviderId, setOverrideProviderId] = useState('api.openai.com');
  const [overrideSensitivity, setOverrideSensitivity] = useState<SensitivityLevel>('Internal');
  const [overrideReason, setOverrideReason] = useState('Approved project-specific external AI usage.');
  const [overrideExpiresAtLocal, setOverrideExpiresAtLocal] = useState('');

  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [integrityResults, setIntegrityResults] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [nextArtifacts, nextDeliverables, nextAudit, nextRoles, nextOverrides] = await Promise.all([
        recordsGovernanceService.listArtifacts(scope),
        recordsGovernanceService.listDeliverables(scope),
        recordsGovernanceService.listAuditEvents(scope, 20),
        recordsGovernanceService.listProjectRoleBindings(scope),
        recordsGovernanceService.listPolicyOverrides(scope),
      ]);

      const versionEntries = await Promise.all(
        nextDeliverables.map(async (deliverable) => {
          const versions = await recordsGovernanceService.listDeliverableVersions(scope, deliverable.id);
          return [deliverable.id, versions] as const;
        }),
      );

      setArtifacts(nextArtifacts);
      setDeliverables(nextDeliverables);
      setAuditEvents(nextAudit);
      setProjectRoles(nextRoles);
      setPolicyOverrides(nextOverrides);
      setDeliverableVersions(Object.fromEntries(versionEntries));

      setVersionDrafts((current) => {
        const next = { ...current };
        for (const deliverable of nextDeliverables) {
          if (!next[deliverable.id]) {
            next[deliverable.id] = {
              artifactId: nextArtifacts[0]?.id ?? '',
              reason: 'Superseding issued deliverable with corrected artifact.',
            };
          } else if (!next[deliverable.id].artifactId && nextArtifacts[0]) {
            next[deliverable.id] = {
              ...next[deliverable.id],
              artifactId: nextArtifacts[0].id,
            };
          }
        }
        return next;
      });
    } catch (loadError) {
      setError(toAppErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canIngest = useMemo(() => {
    return Boolean(selectedFile && selectedFile.name.trim().length > 0);
  }, [selectedFile]);

  const pickFile = async (): Promise<void> => {
    setMessage('');
    setError('');

    try {
      const picked = await fileService.pickRunFiles({
        multiple: false,
        maxFiles: 1,
        maxBytesPerFile: 50 * 1024 * 1024,
      });
      setSelectedFile(picked[0] ?? null);
    } catch (pickError) {
      setError(toAppErrorMessage(pickError));
    }
  };

  const ingestArtifact = async (): Promise<void> => {
    if (!selectedFile) {
      return;
    }

    setBusyAction('ingest');
    setMessage('');
    setError('');

    try {
      const bytes = decodeBase64(selectedFile.dataBase64);
      const ingested = await recordsGovernanceService.ingestArtifact({
        scope,
        bytes,
        originalName: selectedFile.name,
        mimeType: selectedFile.mimeType,
        artifactType,
        discipline,
        status,
        sensitivityLevel,
      });

      setMessage(`Artifact ingested: ${ingested.id} (${ingested.sha256.slice(0, 12)}...).`);
      setSelectedFile(null);
      await refresh();
    } catch (ingestError) {
      setError(toAppErrorMessage(ingestError));
    } finally {
      setBusyAction('');
    }
  };

  const verifyIntegrity = async (artifactId: string): Promise<void> => {
    setIntegrityResults((current) => ({ ...current, [artifactId]: 'Checking...' }));
    setError('');

    try {
      const result = await recordsGovernanceService.verifyArtifactIntegrity(scope, artifactId);
      setIntegrityResults((current) => ({
        ...current,
        [artifactId]: result.valid ? 'Valid' : `Mismatch (${result.computedHash.slice(0, 10)}...)`,
      }));
    } catch (verifyError) {
      setIntegrityResults((current) => ({ ...current, [artifactId]: `Error: ${toAppErrorMessage(verifyError)}` }));
    }
  };

  const finalizeArtifact = async (artifactId: string): Promise<void> => {
    const reason = window.prompt('Finalization reason is required:', 'Issued for record with human review.');
    if (!reason) {
      return;
    }

    setBusyAction(`finalize:${artifactId}`);
    setMessage('');
    setError('');

    try {
      const finalized = await recordsGovernanceService.finalizeArtifact(scope, artifactId, reason);
      setMessage(`Deliverable finalized: ${finalized.deliverableId} (v${finalized.versionNo}).`);
      await refresh();
    } catch (finalizeError) {
      setError(toAppErrorMessage(finalizeError));
    } finally {
      setBusyAction('');
    }
  };

  const setVersionDraft = (deliverableId: string, draft: Partial<VersionDraft>): void => {
    setVersionDrafts((current) => ({
      ...current,
      [deliverableId]: {
        artifactId: current[deliverableId]?.artifactId ?? artifacts[0]?.id ?? '',
        reason: current[deliverableId]?.reason ?? '',
        ...draft,
      },
    }));
  };

  const createVersion = async (deliverableId: string): Promise<void> => {
    const draft = versionDrafts[deliverableId];
    if (!draft?.artifactId) {
      setError('Select an artifact for new version creation.');
      return;
    }
    if (!draft.reason.trim()) {
      setError('Version reason is required.');
      return;
    }

    setBusyAction(`version:${deliverableId}`);
    setMessage('');
    setError('');

    try {
      const result = await recordsGovernanceService.createDeliverableVersion(
        scope,
        deliverableId,
        draft.artifactId,
        draft.reason,
      );
      setMessage(`Created deliverable version v${result.versionNo} for ${deliverableId}.`);
      await refresh();
    } catch (versionError) {
      setError(toAppErrorMessage(versionError));
    } finally {
      setBusyAction('');
    }
  };

  const grantProjectRole = async (): Promise<void> => {
    const actorId = grantRoleActorId.trim();
    if (!actorId) {
      setError('Actor ID is required for role grants.');
      return;
    }

    setBusyAction('grant-role');
    setMessage('');
    setError('');

    try {
      await recordsGovernanceService.grantProjectRole(scope, actorId, grantRoleValue);
      setMessage(`Granted ${grantRoleValue} to ${actorId} in ${scope.projectId}.`);
      await refresh();
    } catch (grantError) {
      setError(toAppErrorMessage(grantError));
    } finally {
      setBusyAction('');
    }
  };

  const grantOverride = async (): Promise<void> => {
    const actorId = overrideActorId.trim();
    const providerId = overrideProviderId.trim().toLowerCase();
    const reason = overrideReason.trim();

    if (!actorId) {
      setError('Actor ID is required for override grants.');
      return;
    }
    if (!providerId) {
      setError('Provider ID is required for override grants.');
      return;
    }
    if (!reason) {
      setError('Override reason is required.');
      return;
    }

    setBusyAction('grant-override');
    setMessage('');
    setError('');

    try {
      const overrideId = await recordsGovernanceService.grantExternalAiOverride({
        scope,
        actorId,
        providerId,
        sensitivityLevel: overrideSensitivity,
        reason,
        expiresAtUtc: overrideExpiresAtLocal ? new Date(overrideExpiresAtLocal).toISOString() : null,
      });
      setMessage(`Granted external-AI override ${overrideId} for ${actorId} (${providerId}).`);
      await refresh();
    } catch (overrideError) {
      setError(toAppErrorMessage(overrideError));
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-semibold text-slate-900">Records Governance</h2>
        <p className="mt-1 text-sm text-slate-600">
          Finalization is irreversible. Overwrite is blocked by design; only append-only versions are permitted.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Workspace ID</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setScope((current) => ({ ...current, workspaceId: event.target.value }))}
              value={scope.workspaceId}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Project ID</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setScope((current) => ({ ...current, projectId: event.target.value }))}
              value={scope.projectId}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Actor ID</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setScope((current) => ({ ...current, actorId: event.target.value }))}
              value={scope.actorId}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Artifact Type</span>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setArtifactType(event.target.value)}
              value={artifactType}
            >
              {artifactTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Discipline</span>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setDiscipline(event.target.value)}
              value={discipline}
            >
              {disciplineOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</span>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              {statusOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Sensitivity</span>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setSensitivityLevel(event.target.value as SensitivityLevel)}
              value={sensitivityLevel}
            >
              {sensitivityOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={() => {
              void pickFile();
            }}
            type="button"
          >
            Choose File
          </button>
          <button
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={!canIngest || busyAction.length > 0}
            onClick={() => {
              void ingestArtifact();
            }}
            type="button"
          >
            {busyAction === 'ingest' ? 'Ingesting...' : 'Ingest Artifact'}
          </button>
          <button
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={() => {
              void refresh();
            }}
            type="button"
          >
            Refresh
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-600">
          Selected file:{' '}
          <span className="font-medium text-slate-800">
            {selectedFile ? `${selectedFile.name} (${formatBytes(selectedFile.size)})` : 'none'}
          </span>
        </p>

        {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Policy Administration</h3>
        <p className="mt-1 text-xs text-slate-600">
          Grant project roles and external AI overrides from the governed service path only.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="rounded border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Grant Project Role</h4>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Actor ID</span>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  onChange={(event) => setGrantRoleActorId(event.target.value)}
                  value={grantRoleActorId}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Role</span>
                <select
                  className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  onChange={(event) => setGrantRoleValue(event.target.value as ProjectRole)}
                  value={grantRoleValue}
                >
                  {projectRoleOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                disabled={busyAction === 'grant-role'}
                onClick={() => {
                  void grantProjectRole();
                }}
                type="button"
              >
                {busyAction === 'grant-role' ? 'Granting...' : 'Grant Role'}
              </button>
            </div>
          </article>

          <article className="rounded border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Grant External AI Override</h4>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Actor ID</span>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  onChange={(event) => setOverrideActorId(event.target.value)}
                  value={overrideActorId}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Provider ID</span>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  onChange={(event) => setOverrideProviderId(event.target.value)}
                  value={overrideProviderId}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Sensitivity</span>
                <select
                  className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  onChange={(event) => setOverrideSensitivity(event.target.value as SensitivityLevel)}
                  value={overrideSensitivity}
                >
                  {sensitivityOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Expires At (optional)</span>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  onChange={(event) => setOverrideExpiresAtLocal(event.target.value)}
                  type="datetime-local"
                  value={overrideExpiresAtLocal}
                />
              </label>
            </div>
            <label className="mt-2 block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Reason</span>
              <textarea
                className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                onChange={(event) => setOverrideReason(event.target.value)}
                rows={2}
                value={overrideReason}
              />
            </label>
            <div className="mt-3 flex justify-end">
              <button
                className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                disabled={busyAction === 'grant-override'}
                onClick={() => {
                  void grantOverride();
                }}
                type="button"
              >
                {busyAction === 'grant-override' ? 'Granting...' : 'Grant Override'}
              </button>
            </div>
          </article>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <article className="rounded border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Project Role Bindings</h4>
            {projectRoles.length === 0 ? (
              <p className="mt-2 text-xs text-slate-600">No role bindings yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {projectRoles.map((row) => (
                  <li className="rounded border border-slate-200 bg-slate-50 px-2 py-1" key={`${row.projectId}:${row.actorId}:${row.role}`}>
                    {row.actorId} | {row.role} | granted by {row.grantedBy} | {new Date(row.grantedAtUtc).toLocaleString()}
                    {row.revokedAtUtc ? ` | revoked ${new Date(row.revokedAtUtc).toLocaleString()}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-900">External AI Overrides</h4>
            {policyOverrides.length === 0 ? (
              <p className="mt-2 text-xs text-slate-600">No overrides yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {policyOverrides.map((row) => (
                  <li className="rounded border border-slate-200 bg-slate-50 px-2 py-1" key={row.id}>
                    {row.actorId} | {row.providerId} | {row.sensitivityLevel} | approved by {row.approvedBy}
                    {row.expiresAtUtc ? ` | expires ${new Date(row.expiresAtUtc).toLocaleString()}` : ' | no expiry'}
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Artifacts</h3>
        <p className="mt-1 text-xs text-slate-600">
          UI never writes to the file system directly; all ingest and read paths go through application services.
        </p>
        {loading ? <p className="mt-3 text-sm text-slate-600">Loading records...</p> : null}

        {!loading && artifacts.length === 0 ? <p className="mt-3 text-sm text-slate-600">No artifacts yet.</p> : null}

        {!loading && artifacts.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Artifact</th>
                  <th className="py-2 pr-3">Type/Status</th>
                  <th className="py-2 pr-3">Hash</th>
                  <th className="py-2 pr-3">Integrity</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {artifacts.map((artifact) => (
                  <tr key={artifact.id}>
                    <td className="py-2 pr-3">
                      <p className="font-medium text-slate-900">{artifact.originalName}</p>
                      <p className="text-xs text-slate-600">
                        {formatBytes(artifact.sizeBytes)} | {artifact.sensitivityLevel}
                      </p>
                    </td>
                    <td className="py-2 pr-3">
                      <p className="text-slate-700">
                        {artifact.artifactType} / {artifact.status}
                      </p>
                      <div className="mt-1">
                        <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                          Immutable
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <code className="text-xs text-slate-700">{artifact.sha256.slice(0, 20)}...</code>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-700">
                      {integrityResults[artifact.id] ?? `Referenced by ${artifact.referencedVersionCount} version(s)`}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          onClick={() => {
                            void verifyIntegrity(artifact.id);
                          }}
                          type="button"
                        >
                          Verify
                        </button>
                        <button
                          className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                          disabled={busyAction === `finalize:${artifact.id}`}
                          onClick={() => {
                            void finalizeArtifact(artifact.id);
                          }}
                          type="button"
                        >
                          {busyAction === `finalize:${artifact.id}` ? 'Finalizing...' : 'Finalize'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Deliverables (Append-Only Versions)</h3>
        {!loading && deliverables.length === 0 ? <p className="mt-3 text-sm text-slate-600">No finalized deliverables yet.</p> : null}

        {deliverables.map((deliverable) => {
          const versions = deliverableVersions[deliverable.id] ?? [];
          const draft = versionDrafts[deliverable.id] ?? {
            artifactId: artifacts[0]?.id ?? '',
            reason: '',
          };

          return (
            <article className="mt-3 rounded border border-slate-200 p-4" key={deliverable.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{deliverable.id}</p>
                  <p className="text-xs text-slate-600">
                    Current version: v{deliverable.currentVersionNo} | Status: {deliverable.status}
                  </p>
                </div>
                <p className="text-xs text-slate-500">Updated: {new Date(deliverable.updatedAtUtc).toLocaleString()}</p>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">New artifact</span>
                  <select
                    className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                    onChange={(event) => setVersionDraft(deliverable.id, { artifactId: event.target.value })}
                    value={draft.artifactId}
                  >
                    <option value="">Select artifact</option>
                    {artifacts.map((artifact) => (
                      <option key={`${deliverable.id}:${artifact.id}`} value={artifact.id}>
                        {artifact.originalName} ({artifact.sha256.slice(0, 8)}...)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Reason</span>
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                    onChange={(event) => setVersionDraft(deliverable.id, { reason: event.target.value })}
                    value={draft.reason}
                  />
                </label>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  disabled={busyAction === `version:${deliverable.id}`}
                  onClick={() => {
                    void createVersion(deliverable.id);
                  }}
                  type="button"
                >
                  {busyAction === `version:${deliverable.id}` ? 'Creating...' : 'Create New Version'}
                </button>
              </div>

              {versions.length > 0 ? (
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  {versions.map((version) => (
                    <li key={version.id}>
                      v{version.versionNo} | artifact {version.artifactId} | {version.artifactHash.slice(0, 12)}... |{' '}
                      {new Date(version.createdAtUtc).toLocaleString()}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Recent Audit Events</h3>
        {auditEvents.length === 0 ? <p className="mt-2 text-sm text-slate-600">No audit events yet.</p> : null}
        {auditEvents.length > 0 ? (
          <ul className="mt-3 space-y-2 text-xs text-slate-700">
            {auditEvents.map((event) => (
              <li className="rounded border border-slate-200 bg-slate-50 px-3 py-2" key={event.id}>
                <p className="font-medium text-slate-800">
                  {event.action} ({event.entityType}:{event.entityId})
                </p>
                <p>
                  {new Date(event.eventTsUtc).toLocaleString()} | actor {event.actorId} | prev{' '}
                  {event.prevHash ? `${event.prevHash.slice(0, 10)}...` : 'null'} | hash {event.eventHash.slice(0, 10)}...
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}
