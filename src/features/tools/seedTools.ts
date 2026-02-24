import type { Tool } from '../../domain/tool';
import { toolSchemaVersion } from '../../schemas/tool';

const now = new Date().toISOString();

export const seedTools: Tool[] = [
  {
    id: 'seed-weather-api',
    version: toolSchemaVersion,
    name: 'Weather Snapshot API',
    description: 'Fetches current weather observations for dashboard cards.',
    type: 'rest_api',
    authType: 'none',
    endpoint: 'https://api.example.com/weather/current',
    status: 'configured',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'seed-tasks-api',
    version: toolSchemaVersion,
    name: 'Task Sync Endpoint',
    description: 'Synchronizes task metadata between local and cloud providers.',
    type: 'openai_compatible',
    authType: 'api_key',
    endpoint: 'https://api.example.com/tasks/sync',
    status: 'missing_credentials',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'seed-notify-webhook',
    version: toolSchemaVersion,
    name: 'Release Notify Webhook',
    description: 'Posts release notifications to external channels.',
    type: 'webhook',
    authType: 'custom_header',
    endpoint: 'https://hooks.example.com/releases',
    status: 'disabled',
    createdAt: now,
    updatedAt: now,
  },
];
