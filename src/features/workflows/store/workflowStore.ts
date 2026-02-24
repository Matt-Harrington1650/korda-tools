import { create } from 'zustand';
import type { Workflow, WorkflowStep } from '../../../domain/workflow';
import { createWorkflowId, createWorkflowStepId } from '../../../lib/ids';
import { workflowRegistrySchema, workflowSchema, workflowSchemaVersion } from '../../../schemas/workflowSchemas';
import { createStorageEngine, hasAsyncLoad } from '../../../storage/createStorageEngine';
import { STORAGE_KEYS } from '../../../storage/keys';
import { migrateWorkflows } from '../../../storage/migrations';

const persistence = createStorageEngine({
  key: STORAGE_KEYS.workflows,
  schema: workflowRegistrySchema,
  defaultValue: {
    version: workflowSchemaVersion,
    workflows: [],
  },
  migrate: migrateWorkflows,
});

const persistWorkflows = (workflows: Workflow[]): void => {
  persistence.save({
    version: workflowSchemaVersion,
    workflows,
  });
};

const createDefaultStep = (): WorkflowStep => {
  return {
    id: createWorkflowStepId(),
    name: 'Step 1',
    toolId: '',
    actionType: 'run',
    payload: '',
    continueOnError: false,
  };
};

type CreateWorkflowInput = {
  name?: string;
  description?: string;
  tags?: string[];
  steps?: WorkflowStep[];
};

type UpdateWorkflowInput = Partial<Omit<Workflow, 'id' | 'version' | 'createdAt'>>;

type WorkflowState = {
  workflows: Workflow[];
  selectedWorkflowId?: string;
  loadWorkflows: () => void;
  createWorkflow: (input?: CreateWorkflowInput) => Workflow;
  updateWorkflow: (workflowId: string, input: UpdateWorkflowInput) => Workflow | null;
  deleteWorkflow: (workflowId: string) => void;
  replaceWorkflows: (workflows: Workflow[]) => void;
  setSelectedWorkflowId: (workflowId?: string) => void;
  getWorkflowById: (workflowId: string) => Workflow | undefined;
};

const hydrateInitialState = (): { workflows: Workflow[]; selectedWorkflowId?: string } => {
  const initialWorkflows = persistence.load().workflows;
  return {
    workflows: initialWorkflows,
    selectedWorkflowId: initialWorkflows[0]?.id,
  };
};

const initialState = hydrateInitialState();

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: initialState.workflows,
  selectedWorkflowId: initialState.selectedWorkflowId,
  loadWorkflows: () => {
    const workflows = persistence.load().workflows;
    set({
      workflows,
      selectedWorkflowId: workflows.some((item) => item.id === get().selectedWorkflowId)
        ? get().selectedWorkflowId
        : workflows[0]?.id,
    });
  },
  createWorkflow: (input = {}) => {
    const now = new Date().toISOString();
    const workflow = workflowSchema.parse({
      id: createWorkflowId(),
      version: workflowSchemaVersion,
      type: 'linear',
      name: input.name?.trim() || 'New Workflow',
      description: input.description?.trim() || '',
      tags: input.tags ?? [],
      steps: input.steps && input.steps.length > 0 ? input.steps : [createDefaultStep()],
      createdAt: now,
      updatedAt: now,
    });

    const nextWorkflows = [workflow, ...get().workflows];
    persistWorkflows(nextWorkflows);
    set({
      workflows: nextWorkflows,
      selectedWorkflowId: workflow.id,
    });

    return workflow;
  },
  updateWorkflow: (workflowId, input) => {
    let updated: Workflow | null = null;

    const nextWorkflows = get().workflows.map((workflow) => {
      if (workflow.id !== workflowId) {
        return workflow;
      }

      updated = workflowSchema.parse({
        ...workflow,
        ...input,
        updatedAt: new Date().toISOString(),
      });

      return updated;
    });

    if (!updated) {
      return null;
    }

    persistWorkflows(nextWorkflows);
    set({ workflows: nextWorkflows });
    return updated;
  },
  deleteWorkflow: (workflowId) => {
    const nextWorkflows = get().workflows.filter((workflow) => workflow.id !== workflowId);
    persistWorkflows(nextWorkflows);
    set({
      workflows: nextWorkflows,
      selectedWorkflowId: get().selectedWorkflowId === workflowId ? nextWorkflows[0]?.id : get().selectedWorkflowId,
    });
  },
  replaceWorkflows: (workflows) => {
    const validated = workflows
      .map((workflow) => workflowSchema.safeParse(workflow))
      .filter((result): result is { success: true; data: Workflow } => result.success)
      .map((result) => result.data);
    persistWorkflows(validated);
    set({
      workflows: validated,
      selectedWorkflowId: validated.some((item) => item.id === get().selectedWorkflowId)
        ? get().selectedWorkflowId
        : validated[0]?.id,
    });
  },
  setSelectedWorkflowId: (workflowId) => {
    set({ selectedWorkflowId: workflowId });
  },
  getWorkflowById: (workflowId) => {
    return get().workflows.find((workflow) => workflow.id === workflowId);
  },
}));

if (hasAsyncLoad(persistence)) {
  void persistence
    .loadAsync()
    .then((persisted) => {
      useWorkflowStore.setState((state) => ({
        workflows: persisted.workflows,
        selectedWorkflowId: persisted.workflows.some((item) => item.id === state.selectedWorkflowId)
          ? state.selectedWorkflowId
          : persisted.workflows[0]?.id,
      }));
    })
    .catch(() => {
      // TODO(extension): add telemetry hook for async workflow hydration failures.
    });
}
