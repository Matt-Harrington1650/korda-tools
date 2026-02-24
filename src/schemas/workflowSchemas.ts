import { z } from 'zod';

export const workflowSchemaVersion = 1 as const;
export const workflowRunSchemaVersion = 1 as const;
export const workflowNodeRunSchemaVersion = 1 as const;

export const workflowTypeSchema = z.literal('linear');
export const workflowStepActionTypeSchema = z.enum(['test', 'run']);

export const workflowStepSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  toolId: z.string().trim().min(1),
  actionType: workflowStepActionTypeSchema,
  payload: z.string().default(''),
  continueOnError: z.boolean().default(false),
});

export const workflowSchema = z.object({
  id: z.string().trim().min(1),
  version: z.literal(workflowSchemaVersion),
  type: workflowTypeSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).default(''),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  steps: z.array(workflowStepSchema).max(100),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const workflowRegistrySchema = z.object({
  version: z.literal(workflowSchemaVersion),
  workflows: z.array(workflowSchema),
});

export const workflowRunStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);

export const workflowNodeRunStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'skipped',
]);

export const workflowRunSchema = z.object({
  id: z.string().trim().min(1),
  version: z.literal(workflowRunSchemaVersion),
  workflowId: z.string().trim().min(1),
  workflowName: z.string().trim().min(1),
  status: workflowRunStatusSchema,
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().nonnegative(),
  errorMessage: z.string().default(''),
});

export const workflowNodeRunSchema = z.object({
  id: z.string().trim().min(1),
  version: z.literal(workflowNodeRunSchemaVersion),
  workflowId: z.string().trim().min(1),
  workflowRunId: z.string().trim().min(1),
  workflowStepId: z.string().trim().min(1),
  stepName: z.string().trim().min(1).max(120),
  toolId: z.string().trim().min(1),
  status: workflowNodeRunStatusSchema,
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().nonnegative(),
  requestSummary: z.string().default(''),
  responseSummary: z.string().default(''),
  output: z.string().default(''),
  errorMessage: z.string().default(''),
});

export const workflowRunHistorySchema = z.object({
  version: z.literal(workflowRunSchemaVersion),
  entries: z.array(workflowRunSchema),
});

export const workflowNodeRunHistorySchema = z.object({
  version: z.literal(workflowNodeRunSchemaVersion),
  entries: z.array(workflowNodeRunSchema),
});

export type WorkflowType = z.infer<typeof workflowTypeSchema>;
export type WorkflowStepActionType = z.infer<typeof workflowStepActionTypeSchema>;
export type WorkflowStep = z.infer<typeof workflowStepSchema>;
export type Workflow = z.infer<typeof workflowSchema>;
export type WorkflowRegistry = z.infer<typeof workflowRegistrySchema>;
export type WorkflowRunStatus = z.infer<typeof workflowRunStatusSchema>;
export type WorkflowNodeRunStatus = z.infer<typeof workflowNodeRunStatusSchema>;
export type WorkflowRun = z.infer<typeof workflowRunSchema>;
export type WorkflowNodeRun = z.infer<typeof workflowNodeRunSchema>;
export type WorkflowRunHistory = z.infer<typeof workflowRunHistorySchema>;
export type WorkflowNodeRunHistory = z.infer<typeof workflowNodeRunHistorySchema>;
