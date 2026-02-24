import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../features/chat/store';
import { useToolRegistryStore } from '../features/tools/store/toolRegistryStore';
import { useSettingsStore } from '../features/settings/store';
import { executeToolWithPipelineStream } from '../execution';
import type { ExecutionResult } from '../execution';
import { createWorkflowStepId } from '../lib/ids';
import { useWorkflowStore } from '../features/workflows/store';

const summarizeAssistantResult = (
  toolName: string,
  result: { ok: boolean; responseSummary?: string; errorMessage?: string; errorDetails?: string },
): string => {
  if (result.ok) {
    return `[${toolName}] Success\n${result.responseSummary ?? ''}`.trim();
  }

  return `[${toolName}] Failed\n${result.errorMessage ?? ''}\n${result.errorDetails ?? ''}`.trim();
};

const truncate = (value: string, max = 64): string => {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max)}...`;
};

export function ChatPage() {
  const navigate = useNavigate();
  const threads = useChatStore((state) => state.threads);
  const selectedThreadId = useChatStore((state) => state.selectedThreadId);
  const createThread = useChatStore((state) => state.createThread);
  const deleteThread = useChatStore((state) => state.deleteThread);
  const setSelectedThreadId = useChatStore((state) => state.setSelectedThreadId);
  const setThreadTitle = useChatStore((state) => state.setThreadTitle);
  const appendMessage = useChatStore((state) => state.appendMessage);
  const startToolCall = useChatStore((state) => state.startToolCall);
  const appendToolOutput = useChatStore((state) => state.appendToolOutput);
  const finishToolCall = useChatStore((state) => state.finishToolCall);
  const tools = useToolRegistryStore((state) => state.tools);
  const getToolById = useToolRegistryStore((state) => state.getToolById);
  const defaultTimeoutMs = useSettingsStore((state) => state.settings.defaultTimeoutMs);
  const createWorkflow = useWorkflowStore((state) => state.createWorkflow);

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? threads[0];
  const [selectedToolId, setSelectedToolId] = useState('');
  const [actionType, setActionType] = useState<'run' | 'test'>('run');
  const [messageInput, setMessageInput] = useState('');
  const [statusText, setStatusText] = useState('Idle');
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!selectedThread && threads.length > 0) {
      setSelectedThreadId(threads[0].id);
    }
  }, [selectedThread, setSelectedThreadId, threads]);

  useEffect(() => {
    if (!selectedToolId && tools.length > 0) {
      setSelectedToolId(tools[0].id);
      return;
    }

    if (selectedToolId && !tools.some((tool) => tool.id === selectedToolId)) {
      setSelectedToolId(tools[0]?.id ?? '');
    }
  }, [selectedToolId, tools]);

  const tracesById = useMemo(() => {
    const map = new Map<string, (typeof selectedThread.toolCalls)[number]>();
    (selectedThread?.toolCalls ?? []).forEach((trace) => {
      map.set(trace.id, trace);
    });
    return map;
  }, [selectedThread?.toolCalls]);

  const cancelRun = (): void => {
    controllerRef.current?.abort(new DOMException('Chat tool call cancelled.', 'AbortError'));
  };

  const handleSend = async (): Promise<void> => {
    setErrorText('');
    setInfoText('');

    const prompt = messageInput.trim();
    if (!prompt) {
      setErrorText('Message is required.');
      return;
    }

    if (!selectedToolId) {
      setErrorText('Select a tool to call.');
      return;
    }

    const tool = getToolById(selectedToolId);
    if (!tool) {
      setErrorText('Selected tool was not found.');
      return;
    }

    const thread = selectedThread ?? createThread('New Chat');
    setSelectedThreadId(thread.id);

    if (thread.messages.length === 0) {
      setThreadTitle(thread.id, truncate(prompt, 48));
    }

    appendMessage(thread.id, 'user', prompt);

    const trace = startToolCall({
      threadId: thread.id,
      toolId: tool.id,
      toolName: tool.name,
      payload: prompt,
      actionType,
    });

    if (!trace) {
      setErrorText('Unable to start tool call trace.');
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setIsRunning(true);
    setStatusText('Running...');
    setMessageInput('');

    try {
      let finalResult: ExecutionResult | null = null;
      let streamedOutput = '';

      const stream = executeToolWithPipelineStream({
        tool,
        actionType,
        payload: prompt,
        timeoutMs: defaultTimeoutMs,
        signal: controller.signal,
        stream: actionType === 'run',
      });

      for await (const event of stream) {
        if (event.type === 'status') {
          setStatusText(event.message ?? event.phase);
          continue;
        }

        if (event.type === 'progress') {
          setStatusText(event.message ?? `Progress ${event.progress}%`);
          continue;
        }

        if (event.type === 'chunk') {
          streamedOutput = `${streamedOutput}${event.chunk}`;
          appendToolOutput({
            threadId: thread.id,
            toolCallId: trace.id,
            outputChunk: event.chunk,
          });
          continue;
        }

        if (event.type === 'error') {
          setStatusText(event.error.message);
          continue;
        }

        if (event.type === 'result') {
          finalResult = event.result;
        }
      }

      if (!finalResult) {
        finishToolCall({
          threadId: thread.id,
          toolCallId: trace.id,
          status: 'failed',
          errorMessage: 'Execution pipeline returned no result.',
          output: streamedOutput,
        });
        appendMessage(thread.id, 'assistant', `[${tool.name}] failed: no result returned`, trace.id);
        setStatusText('Failed');
        return;
      }

      if (finalResult.ok) {
        finishToolCall({
          threadId: thread.id,
          toolCallId: trace.id,
          status: 'succeeded',
          requestSummary: finalResult.requestSummary,
          responseSummary: finalResult.responseSummary,
          output: streamedOutput || finalResult.response.bodyPreview,
        });
        appendMessage(
          thread.id,
          'assistant',
          summarizeAssistantResult(tool.name, {
            ok: true,
            responseSummary: finalResult.responseSummary,
          }),
          trace.id,
        );
        setStatusText('Completed');
      } else {
        const mappedStatus = finalResult.error.code === 'cancelled' ? 'cancelled' : 'failed';
        finishToolCall({
          threadId: thread.id,
          toolCallId: trace.id,
          status: mappedStatus,
          requestSummary: finalResult.requestSummary,
          responseSummary: finalResult.responseSummary,
          output: streamedOutput || `${finalResult.error.message}\n${finalResult.error.details}`,
          errorMessage: `${finalResult.error.message}\n${finalResult.error.details}`,
        });
        appendMessage(
          thread.id,
          'assistant',
          summarizeAssistantResult(tool.name, {
            ok: false,
            errorMessage: finalResult.error.message,
            errorDetails: finalResult.error.details,
          }),
          trace.id,
        );
        setStatusText(mappedStatus === 'cancelled' ? 'Cancelled' : 'Failed');
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      finishToolCall({
        threadId: thread.id,
        toolCallId: trace.id,
        status: controller.signal.aborted ? 'cancelled' : 'failed',
        errorMessage: details,
      });
      appendMessage(thread.id, 'assistant', `[${tool.name}] failed: ${details}`, trace.id);
      setStatusText(controller.signal.aborted ? 'Cancelled' : 'Failed');
      setErrorText(details);
    } finally {
      controllerRef.current = null;
      setIsRunning(false);
    }
  };

  const saveRecipe = (): void => {
    if (!selectedThread) {
      setErrorText('Select a chat thread first.');
      return;
    }

    const traces = selectedThread.toolCalls
      .filter((trace) => trace.toolId.trim().length > 0)
      .sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt));

    if (traces.length === 0) {
      setErrorText('No tool call traces available to save as workflow.');
      return;
    }

    const workflow = createWorkflow({
      name: `Recipe: ${truncate(selectedThread.title, 48)}`,
      description: `Generated from chat thread "${selectedThread.title}"`,
      tags: ['chat-recipe'],
      steps: traces.map((trace, index) => ({
        id: createWorkflowStepId(),
        name: `${index + 1}. ${trace.toolName}`,
        toolId: trace.toolId,
        actionType: trace.actionType,
        payload: trace.payload,
        continueOnError: false,
      })),
    });

    setInfoText(`Workflow "${workflow.name}" created from chat recipe.`);
    setErrorText('');
    navigate('/workflows');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr_360px]">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Chats</h2>
          <button
            className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800"
            onClick={() => {
              const created = createThread('New Chat');
              setSelectedThreadId(created.id);
            }}
            type="button"
          >
            New
          </button>
        </div>
        {threads.length === 0 ? (
          <p className="text-sm text-slate-500">No chat history yet.</p>
        ) : (
          <ul className="space-y-2">
            {threads.map((thread) => (
              <li key={thread.id}>
                <div className="flex items-center gap-2">
                  <button
                    className={`w-full rounded border px-3 py-2 text-left text-sm ${
                      thread.id === selectedThread?.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      setSelectedThreadId(thread.id);
                    }}
                    type="button"
                  >
                    <p className="font-medium">{thread.title}</p>
                    <p className="text-xs opacity-80">{thread.messages.length} message(s)</p>
                  </button>
                  <button
                    className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                    onClick={() => {
                      deleteThread(thread.id);
                    }}
                    type="button"
                  >
                    X
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Chat</h2>
          <button
            className="rounded border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
            disabled={!selectedThread}
            onClick={saveRecipe}
            type="button"
          >
            Save Chat To Workflow
          </button>
        </div>

        {!selectedThread ? (
          <p className="text-sm text-slate-500">Create a chat to get started.</p>
        ) : (
          <>
            <div className="mb-3 max-h-96 space-y-2 overflow-auto rounded border border-slate-200 bg-slate-50 p-3">
              {selectedThread.messages.length === 0 ? (
                <p className="text-sm text-slate-500">No messages yet.</p>
              ) : (
                selectedThread.messages.map((message) => (
                  <div
                    className={`rounded p-2 text-sm ${
                      message.role === 'user'
                        ? 'bg-slate-900 text-white'
                        : message.role === 'assistant'
                          ? 'bg-white text-slate-800'
                          : 'bg-amber-50 text-amber-900'
                    }`}
                    key={message.id}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{message.role}</p>
                    <pre className="mt-1 whitespace-pre-wrap text-sm">{message.content}</pre>
                    {message.toolCallId ? (
                      <p className="mt-1 text-xs opacity-70">
                        Trace: {tracesById.get(message.toolCallId)?.toolName ?? message.toolCallId} (
                        {tracesById.get(message.toolCallId)?.status ?? 'unknown'})
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <div className="grid gap-2 md:grid-cols-[1fr_140px_120px]">
              <textarea
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => {
                  setMessageInput(event.target.value);
                }}
                placeholder="Type message / payload for selected tool..."
                rows={4}
                value={messageInput}
              />
              <select
                className="rounded border border-slate-300 px-2 py-2 text-sm"
                onChange={(event) => {
                  setSelectedToolId(event.target.value);
                }}
                value={selectedToolId}
              >
                {tools.map((tool) => (
                  <option key={tool.id} value={tool.id}>
                    {tool.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded border border-slate-300 px-2 py-2 text-sm"
                onChange={(event) => {
                  setActionType(event.target.value === 'test' ? 'test' : 'run');
                }}
                value={actionType}
              >
                <option value="run">Run</option>
                <option value="test">Test</option>
              </select>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
                disabled={isRunning || tools.length === 0}
                onClick={() => {
                  void handleSend();
                }}
                type="button"
              >
                {isRunning ? 'Running...' : 'Send + Call Tool'}
              </button>
              <button
                className="rounded border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-70"
                disabled={!isRunning}
                onClick={cancelRun}
                type="button"
              >
                Cancel
              </button>
              <p className="text-xs text-slate-600">Status: {statusText}</p>
            </div>
            {errorText ? <p className="mt-2 text-sm text-rose-700">{errorText}</p> : null}
            {infoText ? <p className="mt-2 text-sm text-emerald-700">{infoText}</p> : null}
          </>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-base font-semibold text-slate-900">Tool Call Traces</h3>
        {!selectedThread || selectedThread.toolCalls.length === 0 ? (
          <p className="text-sm text-slate-500">No traces recorded.</p>
        ) : (
          <ul className="space-y-2">
            {selectedThread.toolCalls
              .slice()
              .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
              .map((trace) => (
                <li className="rounded border border-slate-200 p-3 text-xs" key={trace.id}>
                  <p className="font-semibold text-slate-900">{trace.toolName}</p>
                  <p className="text-slate-600">
                    {trace.actionType} - {trace.status}
                  </p>
                  <p className="mt-1 text-slate-600">Request: {trace.requestSummary || 'n/a'}</p>
                  <p className="mt-1 text-slate-600">Response: {trace.responseSummary || 'n/a'}</p>
                  {trace.output ? (
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-emerald-200">
                      {trace.output}
                    </pre>
                  ) : null}
                  {trace.errorMessage ? <p className="mt-2 text-rose-700">{trace.errorMessage}</p> : null}
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
