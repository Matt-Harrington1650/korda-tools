import type { Tool } from '../../domain/tool';
import { toolSchemaVersion } from '../../schemas/tool';

const now = new Date().toISOString();

export const seedTools: Tool[] = [
  {
    id: 'seed-weather-api',
    version: toolSchemaVersion,
    name: 'Weather Snapshot API',
    description: 'Fetches current weather observations for dashboard cards.',
    type: 'rest',
    endpoint: 'https://api.example.com/weather/current',
    status: 'healthy',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'seed-tasks-api',
    version: toolSchemaVersion,
    name: 'Task Sync Endpoint',
    description: 'Synchronizes task metadata between local and cloud providers.',
    type: 'rest',
    endpoint: 'https://api.example.com/tasks/sync',
    status: 'degraded',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'seed-notify-webhook',
    version: toolSchemaVersion,
    name: 'Release Notify Webhook',
    description: 'Posts release notifications to external channels.',
    type: 'webhook',
    endpoint: 'https://hooks.example.com/releases',
    status: 'offline',
    createdAt: now,
    updatedAt: now,
  },
];
