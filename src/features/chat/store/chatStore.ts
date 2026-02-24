import { create } from 'zustand';
import type { ChatMessage, ChatMessageRole, ChatThread, ChatToolCallTrace } from '../../../domain/chat';
import { createChatMessageId, createChatThreadId, createChatToolCallId } from '../../../lib/ids';
import {
  chatThreadRegistrySchema,
  chatThreadSchema,
  chatThreadSchemaVersion,
  chatToolCallTraceSchema,
  type ChatToolCallStatus,
} from '../../../schemas/chatSchemas';
import { createStorageEngine, hasAsyncLoad } from '../../../storage/createStorageEngine';
import { STORAGE_KEYS } from '../../../storage/keys';
import { migrateChatThreads } from '../../../storage/migrations';

const persistence = createStorageEngine({
  key: STORAGE_KEYS.chatThreads,
  schema: chatThreadRegistrySchema,
  defaultValue: {
    version: chatThreadSchemaVersion,
    threads: [],
  },
  migrate: migrateChatThreads,
});

const persistThreads = (threads: ChatThread[]): void => {
  persistence.save({
    version: chatThreadSchemaVersion,
    threads,
  });
};

const nowIso = (): string => new Date().toISOString();

const createMessage = (
  role: ChatMessageRole,
  content: string,
  toolCallId?: string,
): ChatMessage => ({
  id: createChatMessageId(),
  role,
  content,
  timestamp: nowIso(),
  toolCallId,
});

type StartToolCallInput = {
  threadId: string;
  toolId: string;
  toolName: string;
  payload: string;
  actionType: 'test' | 'run';
};

type FinishToolCallInput = {
  threadId: string;
  toolCallId: string;
  status: ChatToolCallStatus;
  requestSummary?: string;
  responseSummary?: string;
  output?: string;
  errorMessage?: string;
};

type AppendToolOutputInput = {
  threadId: string;
  toolCallId: string;
  outputChunk: string;
};

type ChatState = {
  threads: ChatThread[];
  selectedThreadId?: string;
  createThread: (title?: string) => ChatThread;
  deleteThread: (threadId: string) => void;
  setSelectedThreadId: (threadId?: string) => void;
  getThreadById: (threadId: string) => ChatThread | undefined;
  appendMessage: (threadId: string, role: ChatMessageRole, content: string, toolCallId?: string) => ChatMessage | null;
  startToolCall: (input: StartToolCallInput) => ChatToolCallTrace | null;
  appendToolOutput: (input: AppendToolOutputInput) => ChatToolCallTrace | null;
  finishToolCall: (input: FinishToolCallInput) => ChatToolCallTrace | null;
  setThreadTitle: (threadId: string, title: string) => void;
};

const hydrateInitialState = (): { threads: ChatThread[]; selectedThreadId?: string } => {
  const threads = persistence.load().threads;
  return {
    threads,
    selectedThreadId: threads[0]?.id,
  };
};

const initialState = hydrateInitialState();

const withUpdatedThread = (
  threads: ChatThread[],
  threadId: string,
  updater: (thread: ChatThread) => ChatThread,
): { nextThreads: ChatThread[]; updatedThread: ChatThread | null } => {
  let updatedThread: ChatThread | null = null;
  const nextThreads = threads.map((thread) => {
    if (thread.id !== threadId) {
      return thread;
    }

    updatedThread = chatThreadSchema.parse(updater(thread));
    return updatedThread;
  });

  return {
    nextThreads,
    updatedThread,
  };
};

export const useChatStore = create<ChatState>((set, get) => ({
  threads: initialState.threads,
  selectedThreadId: initialState.selectedThreadId,
  createThread: (title = 'New Chat') => {
    const timestamp = nowIso();
    const thread = chatThreadSchema.parse({
      id: createChatThreadId(),
      version: chatThreadSchemaVersion,
      title: title.trim() || 'New Chat',
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [],
      toolCalls: [],
    });

    const nextThreads = [thread, ...get().threads];
    persistThreads(nextThreads);
    set({
      threads: nextThreads,
      selectedThreadId: thread.id,
    });
    return thread;
  },
  deleteThread: (threadId) => {
    const nextThreads = get().threads.filter((thread) => thread.id !== threadId);
    persistThreads(nextThreads);
    set({
      threads: nextThreads,
      selectedThreadId: get().selectedThreadId === threadId ? nextThreads[0]?.id : get().selectedThreadId,
    });
  },
  setSelectedThreadId: (threadId) => {
    set({ selectedThreadId: threadId });
  },
  getThreadById: (threadId) => {
    return get().threads.find((thread) => thread.id === threadId);
  },
  appendMessage: (threadId, role, content, toolCallId) => {
    const message = createMessage(role, content, toolCallId);
    const { nextThreads, updatedThread } = withUpdatedThread(get().threads, threadId, (thread) => ({
      ...thread,
      messages: [...thread.messages, message],
      updatedAt: nowIso(),
    }));

    if (!updatedThread) {
      return null;
    }

    persistThreads(nextThreads);
    set({ threads: nextThreads });
    return message;
  },
  startToolCall: (input) => {
    const trace = chatToolCallTraceSchema.parse({
      id: createChatToolCallId(),
      toolId: input.toolId,
      toolName: input.toolName,
      actionType: input.actionType,
      payload: input.payload,
      status: 'running',
      startedAt: nowIso(),
      completedAt: null,
      requestSummary: '',
      responseSummary: '',
      output: '',
      errorMessage: '',
    });

    const { nextThreads, updatedThread } = withUpdatedThread(get().threads, input.threadId, (thread) => ({
      ...thread,
      toolCalls: [...thread.toolCalls, trace],
      updatedAt: nowIso(),
    }));

    if (!updatedThread) {
      return null;
    }

    persistThreads(nextThreads);
    set({ threads: nextThreads });
    return trace;
  },
  appendToolOutput: (input) => {
    let nextTrace: ChatToolCallTrace | null = null;
    const { nextThreads, updatedThread } = withUpdatedThread(get().threads, input.threadId, (thread) => ({
      ...thread,
      toolCalls: thread.toolCalls.map((trace) => {
        if (trace.id !== input.toolCallId) {
          return trace;
        }

        nextTrace = chatToolCallTraceSchema.parse({
          ...trace,
          output: `${trace.output}${input.outputChunk}`,
        });
        return nextTrace;
      }),
      updatedAt: nowIso(),
    }));

    if (!updatedThread || !nextTrace) {
      return null;
    }

    persistThreads(nextThreads);
    set({ threads: nextThreads });
    return nextTrace;
  },
  finishToolCall: (input) => {
    let nextTrace: ChatToolCallTrace | null = null;

    const { nextThreads, updatedThread } = withUpdatedThread(get().threads, input.threadId, (thread) => ({
      ...thread,
      toolCalls: thread.toolCalls.map((trace) => {
        if (trace.id !== input.toolCallId) {
          return trace;
        }

        nextTrace = chatToolCallTraceSchema.parse({
          ...trace,
          status: input.status,
          completedAt: nowIso(),
          requestSummary: input.requestSummary ?? trace.requestSummary,
          responseSummary: input.responseSummary ?? trace.responseSummary,
          output: input.output ?? trace.output,
          errorMessage: input.errorMessage ?? trace.errorMessage,
        });
        return nextTrace;
      }),
      updatedAt: nowIso(),
    }));

    if (!updatedThread || !nextTrace) {
      return null;
    }

    persistThreads(nextThreads);
    set({ threads: nextThreads });
    return nextTrace;
  },
  setThreadTitle: (threadId, title) => {
    const clean = title.trim();
    if (!clean) {
      return;
    }

    const { nextThreads, updatedThread } = withUpdatedThread(get().threads, threadId, (thread) => ({
      ...thread,
      title: clean,
      updatedAt: nowIso(),
    }));

    if (!updatedThread) {
      return;
    }

    persistThreads(nextThreads);
    set({ threads: nextThreads });
  },
}));

if (hasAsyncLoad(persistence)) {
  void persistence
    .loadAsync()
    .then((persisted) => {
      useChatStore.setState((state) => ({
        threads: persisted.threads,
        selectedThreadId: persisted.threads.some((thread) => thread.id === state.selectedThreadId)
          ? state.selectedThreadId
          : persisted.threads[0]?.id,
      }));
    })
    .catch(() => {
      // TODO(extension): add telemetry hook for async chat hydration failures.
    });
}
