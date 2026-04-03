import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';

import {
  buildAgentMainSessionKey,
  ChannelsStatusSnapshot,
  GatewayChatEventPayload,
  GatewayChatMessage,
  GatewaySessionPreviewEntry,
  GatewaySessionRow,
  loadRuntimeGatewayConfig,
  OpenClawGatewayClient,
  resolveAgentIdFromSessionKey,
  resolveGatewayUrl,
  resolveSessionText,
  SessionsListResult,
  type AgentsListResult,
} from '@/lib/openclaw-gateway';

type ChatProps = {
  standalone?: boolean;
};

type UiMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  streaming?: boolean;
};

type SessionMessageEventPayload = {
  sessionKey?: string;
  message?: GatewayChatMessage;
  messageId?: string;
  messageSeq?: number;
};

type SessionPreviewResult = {
  previews?: Array<{
    key: string;
    status: string;
    items: GatewaySessionPreviewEntry[];
  }>;
};

type SessionCreateResult = {
  key: string;
};

type AgentOption = {
  id: string;
  label: string;
  name: string;
  description: string;
  emoji: string;
  avatarUrl?: string;
};

const FALLBACK_AGENTS: AgentOption[] = [
  { id: 'main', label: 'Rem', name: 'Rem', description: 'Default OpenClaw agent', emoji: '✨' },
  { id: 'nyx', label: 'Nyx', name: 'Nyx', description: 'Senior engineer', emoji: '🔮' },
  { id: 'kai', label: 'Kai', name: 'Kai', description: 'Junior analyst', emoji: '⚡' },
  { id: 'moh', label: 'Moh', name: 'Moh', description: 'Generalist', emoji: '🟠' },
];

function messageId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatInboxTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return 'Now';
  }
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function stripInboundMetadata(text: string): string {
  return text
    .replace(/Sender \(untrusted metadata\):\n```json\n[\s\S]*?\n```\n\n/g, '')
    .replace(/Conversation info \(untrusted metadata\):\n```json\n[\s\S]*?\n```\n\n/g, '')
    .replace(/Thread starter \(untrusted, for context\):\n```json\n[\s\S]*?\n```\n\n/g, '')
    .replace(/Replied message \(untrusted, for context\):\n```json\n[\s\S]*?\n```\n\n/g, '')
    .replace(/Forwarded message context \(untrusted metadata\):\n```json\n[\s\S]*?\n```\n\n/g, '')
    .replace(/Chat history since last reply \(untrusted, for context\):\n```json\n[\s\S]*?\n```\n\n/g, '')
    .replace(/^\[[^\]]+\]\s*/gm, '')
    .trim();
}

function sanitizeMessageText(message: GatewayChatMessage | undefined): string {
  return stripInboundMetadata(resolveSessionText(message));
}

function mapHistoryMessage(message: GatewayChatMessage, index: number): UiMessage | null {
  const role = message.role === 'user' ? 'user' : message.role === 'assistant' ? 'assistant' : 'system';
  const content = sanitizeMessageText(message);
  if (!content) {
    return null;
  }
  return {
    id: `${index}:${message.timestamp ?? Date.now()}`,
    role,
    content,
    timestamp: message.timestamp ?? Date.now(),
  };
}

function mergeLiveMessage(previous: UiMessage[], incoming: UiMessage, streamingRunId: string | null): UiMessage[] {
  const duplicate = previous.some(
    (message) =>
      message.role === incoming.role &&
      message.content === incoming.content &&
      Math.abs(message.timestamp - incoming.timestamp) < 2_000,
  );
  if (duplicate) {
    return previous;
  }

  if (incoming.role === 'assistant' && streamingRunId) {
    const streamingIndex = previous.findIndex((message) => message.id === `run:${streamingRunId}`);
    if (streamingIndex >= 0) {
      const next = [...previous];
      next[streamingIndex] = {
        ...incoming,
        id: next[streamingIndex].id,
        streaming: false,
      };
      return next;
    }
  }

  return [...previous, incoming];
}

function normalizeAgents(result: AgentsListResult | null): AgentOption[] {
  if (!result?.agents?.length) {
    return FALLBACK_AGENTS;
  }
  return result.agents.map((agent) => ({
    id: agent.id,
    label: agent.identity?.name || agent.name || agent.id,
    name: agent.identity?.name || agent.name || agent.id,
    description: 'OpenClaw agent',
    emoji: agent.identity?.emoji || '✦',
    avatarUrl: agent.identity?.avatarUrl,
  }));
}

function buildSessionTitle(session: GatewaySessionRow, selectedAgent: AgentOption | undefined): string {
  if (session.key === buildAgentMainSessionKey(resolveAgentIdFromSessionKey(session.key) || 'main')) {
    return `Chat with ${selectedAgent?.label || 'agent'}`;
  }
  return session.displayName || session.label || session.subject || session.room || 'New conversation';
}

function buildSessionMeta(session: GatewaySessionRow, channelsSnapshot: ChannelsStatusSnapshot | null): string {
  const parts: string[] = [];
  if (session.surface) {
    parts.push(channelsSnapshot?.channelLabels?.[session.surface] || session.surface);
  }
  if (session.space) {
    parts.push(session.space);
  }
  if (session.room) {
    parts.push(session.room);
  }
  if (session.subject && session.subject !== session.displayName) {
    parts.push(session.subject);
  }
  if (!parts.length) {
    parts.push(session.kind === 'direct' ? 'Direct' : session.kind);
  }
  return parts.join(' • ');
}

function previewSnippet(preview: GatewaySessionPreviewEntry[] | undefined): string {
  const last = preview?.[preview.length - 1];
  if (!last) {
    return 'No messages yet';
  }
  return stripInboundMetadata(last.text || '').replace(/\s+/g, ' ').trim() || 'No messages yet';
}

function TypingBubble({ emoji }: { label: string; emoji: string }) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-soft">
        <span className="text-sm">{emoji}</span>
      </div>
      <div className="rounded-[26px] rounded-bl-md bg-white px-4 py-3 shadow-soft">
        <div className="flex items-center gap-1.5">
          <span className="typing-dot h-2.5 w-2.5 rounded-full bg-[#9BB9D9]" />
          <span className="typing-dot h-2.5 w-2.5 rounded-full bg-[#9BB9D9]" />
          <span className="typing-dot h-2.5 w-2.5 rounded-full bg-[#9BB9D9]" />
        </div>
      </div>
    </div>
  );
}

function UserBubble({ msg }: { msg: UiMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[86%] overflow-hidden rounded-[28px] rounded-br-lg bg-[#0A84FF] px-4 py-3 text-sm text-white shadow-soft sm:max-w-[82%]">
        <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content}</div>
        <div className="mt-1.5 text-right text-[11px] text-white/75">{formatTimestamp(msg.timestamp)}</div>
      </div>
    </div>
  );
}

function AssistantBubble({ msg, emoji }: { msg: UiMessage; label: string; emoji: string }) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-soft">
        <span className="text-sm">{emoji || '✦'}</span>
      </div>
      <div className="max-w-[90%] overflow-hidden rounded-[28px] rounded-bl-lg bg-white px-4 py-3 text-sm text-text-primary shadow-soft sm:max-w-[86%]">
        <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content || '…'}</div>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-text-muted">
          <span>{formatTimestamp(msg.timestamp)}</span>
          {msg.streaming ? <span className="animate-pulse">typing</span> : null}
        </div>
      </div>
    </div>
  );
}

function SystemBubble({ msg }: { msg: UiMessage }) {
  return (
    <div className="flex justify-center">
      <div className="max-w-[92%] break-words rounded-[20px] bg-white/85 px-3 py-1.5 text-center text-xs text-text-secondary shadow-soft [overflow-wrap:anywhere] sm:max-w-[70%]">
        {msg.content}
      </div>
    </div>
  );
}

export const Chat: React.FC<ChatProps> = ({ standalone = false }) => {
  const [gatewayReady, setGatewayReady] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [agents, setAgents] = useState<AgentOption[]>(FALLBACK_AGENTS);
  const [selectedAgentId, setSelectedAgentId] = useState('main');
  const [sessions, setSessions] = useState<GatewaySessionRow[]>([]);
  const [channelsSnapshot, setChannelsSnapshot] = useState<ChannelsStatusSnapshot | null>(null);
  const [selectedSessionKey, setSelectedSessionKey] = useState(buildAgentMainSessionKey('main'));
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [streamingRunId, setStreamingRunId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionPreviewByKey, setSessionPreviewByKey] = useState<Record<string, GatewaySessionPreviewEntry[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);

  const clientRef = useRef<OpenClawGatewayClient | null>(null);
  const connectedRef = useRef(false);
  const selectedSessionKeyRef = useRef(selectedSessionKey);
  const streamingRunIdRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? agents[0];

  // All sessions sorted by updatedAt descending — no agent filter
  const allSessions = useMemo(
    () => [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [sessions],
  );

  // Search filter
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return allSessions;
    const q = searchQuery.toLowerCase();
    return allSessions.filter((session) => {
      const agentId = resolveAgentIdFromSessionKey(session.key);
      const agent = agents.find((a) => a.id === agentId);
      const title = buildSessionTitle(session, agent).toLowerCase();
      return title.includes(q) || (agent?.name?.toLowerCase() ?? '').includes(q);
    });
  }, [allSessions, searchQuery, agents, channelsSnapshot]);

  const currentSession =
    allSessions.find((session) => session.key === selectedSessionKey) ??
    allSessions[0] ??
    null;

  const currentSessionTitle = currentSession
    ? buildSessionTitle(currentSession, selectedAgent)
    : `Chat with ${selectedAgent?.label || 'agent'}`;

  const currentSessionMeta = currentSession
    ? buildSessionMeta(currentSession, channelsSnapshot)
    : selectedAgent?.description || 'Direct chat';

  const refreshSessions = async () => {
    const client = clientRef.current;
    if (!client || !connectedRef.current) {
      return;
    }
    const [sessionResult, channelResult] = await Promise.all([
      client.request<SessionsListResult>('sessions.list', {
        includeGlobal: true,
        includeUnknown: true,
        limit: 200,
      }),
      client.request<ChannelsStatusSnapshot>('channels.status', {
        probe: false,
        timeoutMs: 4000,
      }),
    ]);
    setSessions(sessionResult.sessions || []);
    setChannelsSnapshot(channelResult || null);
  };

  const refreshPreviews = async (keys: string[]) => {
    const client = clientRef.current;
    if (!client || !connectedRef.current || keys.length === 0) {
      return;
    }
    try {
      const result = await client.request<SessionPreviewResult>('sessions.preview', {
        keys,
        limit: 1,
        maxChars: 160,
      });
      const next: Record<string, GatewaySessionPreviewEntry[]> = {};
      for (const item of result.previews || []) {
        next[item.key] = item.items || [];
      }
      setSessionPreviewByKey((previous) => ({ ...previous, ...next }));
    } catch {
      // Preview misses should not break chat UX.
    }
  };

  const startNewChat = async (agentId = selectedAgentId) => {
    const client = clientRef.current;
    if (!client || !connectedRef.current || creatingSession) {
      return;
    }
    setCreatingSession(true);
    setGatewayError(null);
    try {
      const created = await client.request<SessionCreateResult>('sessions.create', { agentId });
      await refreshSessions();
      setSelectedAgentId(agentId);
      setSelectedSessionKey(created.key);
      setMessages([]);
    } catch (error) {
      setGatewayError(error instanceof Error ? error.message : String(error));
    } finally {
      setCreatingSession(false);
    }
  };

  // Suppress unused variable warning — startNewChat is available for future use
  void startNewChat;
  void gatewayReady;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatBusy]);

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  useEffect(() => {
    selectedSessionKeyRef.current = selectedSessionKey;
  }, [selectedSessionKey]);

  useEffect(() => {
    streamingRunIdRef.current = streamingRunId;
  }, [streamingRunId]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }
    element.style.height = '0px';
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }, [inputValue]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const config = await loadRuntimeGatewayConfig();
      const token = config?.gatewayToken?.trim() ?? '';
      const url = resolveGatewayUrl(config);

      if (!token) {
        if (!cancelled) {
          setGatewayReady(true);
          setGatewayError('`rem-admin` needs OPENCLAW_GATEWAY_TOKEN in its container environment for native chat.');
        }
        return;
      }

      const client = new OpenClawGatewayClient({
        url,
        token,
        onOpen: () => {
          if (!cancelled) {
            setConnected(true);
            setGatewayError(null);
          }
        },
        onClose: (reason) => {
          if (!cancelled) {
            setConnected(false);
            setGatewayError(reason ? `Gateway disconnected: ${reason}` : 'Gateway disconnected.');
          }
        },
        onEvent: (event) => {
          if (cancelled) {
            return;
          }

          if (event.event === 'chat') {
            const payload = event.payload as GatewayChatEventPayload | undefined;
            if (!payload || payload.sessionKey !== selectedSessionKeyRef.current) {
              return;
            }

            if (payload.state === 'delta') {
              const content = sanitizeMessageText(payload.message);
              if (!content) {
                return;
              }
              setStreamingRunId(payload.runId);
              setMessages((previous) => {
                const existingIndex = previous.findIndex((message) => message.id === `run:${payload.runId}`);
                if (existingIndex >= 0) {
                  const next = [...previous];
                  next[existingIndex] = { ...next[existingIndex], content, streaming: true };
                  return next;
                }
                return [
                  ...previous,
                  {
                    id: `run:${payload.runId}`,
                    role: 'assistant',
                    content,
                    timestamp: Date.now(),
                    streaming: true,
                  },
                ];
              });
              return;
            }

            if (payload.state === 'final' || payload.state === 'aborted') {
              const finalText = sanitizeMessageText(payload.message);
              setStreamingRunId(null);
              setChatBusy(false);
              setMessages((previous) => {
                const existingIndex = previous.findIndex((message) => message.id === `run:${payload.runId}`);
                if (existingIndex >= 0) {
                  const next = [...previous];
                  next[existingIndex] = {
                    ...next[existingIndex],
                    content: finalText || next[existingIndex].content,
                    streaming: false,
                  };
                  return next;
                }
                if (!finalText) {
                  return previous;
                }
                return [
                  ...previous,
                  {
                    id: `run:${payload.runId}`,
                    role: 'assistant',
                    content: finalText,
                    timestamp: Date.now(),
                    streaming: false,
                  },
                ];
              });
              void refreshSessions();
              return;
            }

            if (payload.state === 'error') {
              setStreamingRunId(null);
              setChatBusy(false);
              setGatewayError(payload.errorMessage || 'Chat request failed.');
              void refreshSessions();
            }
            return;
          }

          if (event.event === 'session.message') {
            const payload = event.payload as SessionMessageEventPayload | undefined;
            if (!payload || payload.sessionKey !== selectedSessionKeyRef.current) {
              return;
            }

            const normalized = mapHistoryMessage(payload.message as GatewayChatMessage, 0);
            if (!normalized) {
              return;
            }

            const eventMessage: UiMessage = {
              ...normalized,
              id:
                payload.messageId ||
                `${payload.messageSeq ?? 'live'}:${normalized.timestamp}:${normalized.role}:${normalized.content}`,
              streaming: false,
            };

            setMessages((previous) => mergeLiveMessage(previous, eventMessage, streamingRunIdRef.current));
            if (normalized.role === 'assistant') {
              setStreamingRunId(null);
              setChatBusy(false);
            }
            void refreshSessions();
            return;
          }

          if (event.event === 'sessions.changed') {
            void refreshSessions();
          }
        },
      });

      clientRef.current = client;
      client.start();
      setGatewayReady(true);

      try {
        await client.whenReady();
        const [agentResult, sessionResult, channelResult] = await Promise.all([
          client.request<AgentsListResult>('agents.list', {}),
          client.request<SessionsListResult>('sessions.list', {
            includeGlobal: true,
            includeUnknown: true,
            limit: 200,
          }),
          client.request<ChannelsStatusSnapshot>('channels.status', {
            probe: false,
            timeoutMs: 4000,
          }),
        ]);

        if (cancelled) {
          return;
        }

        const normalizedAgents = normalizeAgents(agentResult);
        const initialAgentId = agentResult.defaultId || normalizedAgents[0]?.id || 'main';
        const initialSessionKey =
          sessionResult.sessions?.find((session) => resolveAgentIdFromSessionKey(session.key) === initialAgentId)?.key ||
          buildAgentMainSessionKey(initialAgentId);

        setAgents(normalizedAgents);
        setSelectedAgentId(initialAgentId);
        setSessions(sessionResult.sessions || []);
        setChannelsSnapshot(channelResult || null);
        setSelectedSessionKey(initialSessionKey);

        // Fetch previews for all agents
        const allAgentKeys = normalizedAgents.map((a: AgentOption) => buildAgentMainSessionKey(a.id));
        if (allAgentKeys.length > 0 && client) {
          client.request<SessionPreviewResult>('sessions.preview', { keys: allAgentKeys, limit: 1, maxChars: 160 })
            .then((res: SessionPreviewResult) => {
              if (res?.previews) {
                const next: Record<string, GatewaySessionPreviewEntry[]> = {};
                for (const item of res.previews) {
                  next[item.key] = item.items || [];
                }
                setSessionPreviewByKey((previous) => ({ ...previous, ...next }));
              }
            })
            .catch(() => {});
        }
      } catch (error) {
        if (!cancelled) {
          setGatewayError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
      clientRef.current?.stop();
      clientRef.current = null;
    };
  }, []);

  // Fallback: if selectedSessionKey falls outside allSessions, reset
  useEffect(() => {
    const candidateSession = allSessions.find((session) => session.key === selectedSessionKey);
    if (!candidateSession && allSessions.length > 0) {
      const fallback = allSessions[0]?.key || buildAgentMainSessionKey(selectedAgentId);
      setSelectedSessionKey(fallback);
    }
  }, [selectedAgentId, selectedSessionKey, allSessions]);

  // Refresh previews whenever session list changes
  useEffect(() => {
    if (allSessions.length === 0) {
      return;
    }
    void refreshPreviews(allSessions.slice(0, 30).map((session) => session.key));
  }, [allSessions]);

  // History load
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !connected || !selectedSessionKey) {
      return;
    }

    let cancelled = false;
    setLoadingHistory(true);
    setGatewayError(null);

    void client.request('sessions.messages.subscribe', { key: selectedSessionKey });

    void client
      .request<{ messages?: GatewayChatMessage[] }>('chat.history', {
        sessionKey: selectedSessionKey,
        limit: 100,
      })
      .then((result) => {
        if (cancelled) {
          return;
        }
        const normalized = (result.messages || [])
          .map((message, index) => mapHistoryMessage(message, index))
          .filter((message): message is UiMessage => message !== null);
        setMessages(normalized);
      })
      .catch((error) => {
        if (!cancelled) {
          setGatewayError(error instanceof Error ? error.message : String(error));
          setMessages([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingHistory(false);
        }
      });

    return () => {
      cancelled = true;
      void client.request('sessions.messages.unsubscribe', { key: selectedSessionKey });
    };
  }, [connected, selectedSessionKey]);

  const handleSend = async () => {
    const client = clientRef.current;
    const text = inputValue.trim();
    if (!client || !text || !connected || chatBusy) {
      return;
    }

    const userMessage: UiMessage = {
      id: messageId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((previous) => [...previous, userMessage]);
    setInputValue('');
    setChatBusy(true);
    setGatewayError(null);

    try {
      const runId = messageId();
      setStreamingRunId(runId);
      await client.request('chat.send', {
        sessionKey: selectedSessionKey,
        message: text,
        deliver: false,
        idempotencyKey: runId,
      });
      void refreshPreviews([selectedSessionKey]);
    } catch (error) {
      setChatBusy(false);
      setStreamingRunId(null);
      setGatewayError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className={standalone ? 'min-h-[100dvh] bg-[#f0f2f5] p-0 sm:p-4' : 'flex-1 min-h-0'}>
      <div
        className={
          standalone
            ? 'mx-auto max-w-[1600px] h-[100dvh] sm:h-[calc(100dvh-32px)] flex overflow-hidden bg-white sm:rounded-2xl shadow-lg'
            : 'flex h-full overflow-hidden bg-white rounded-xl'
        }
      >
        {/* LEFT PANEL — Conversation List */}
        <aside
          className={`
            ${leftPanelOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0 lg:relative
            absolute inset-y-0 left-0 z-30
            w-full sm:w-[380px] lg:w-[340px] xl:w-[380px]
            flex flex-col border-r border-gray-200 bg-white
            transition-transform duration-200
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-900">Messages</h1>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                  connected ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'}`} />
                {connected ? 'Connected' : 'Offline'}
              </span>
              <button
                onClick={() => void refreshSessions()}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto">
            {filteredSessions.map((session) => {
              const agentId = resolveAgentIdFromSessionKey(session.key);
              const agent = agents.find((a) => a.id === agentId);
              const preview = sessionPreviewByKey[session.key];
              const isActive = session.key === selectedSessionKey;
              const title = buildSessionTitle(session, agent);
              const meta = buildSessionMeta(session, channelsSnapshot);
              const snippet = preview?.[0]?.text ? previewSnippet(preview) : meta || 'No messages yet';
              const time = session.updatedAt ? formatInboxTimestamp(session.updatedAt) : '';

              return (
                <button
                  key={session.key}
                  onClick={() => {
                    setSelectedSessionKey(session.key);
                    if (agentId) setSelectedAgentId(agentId);
                    setLeftPanelOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-50 ${
                    isActive ? 'bg-blue-50' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: isActive ? '#EBF5FF' : '#F3F4F6' }}
                  >
                    {agent?.avatarUrl ? (
                      <img src={agent.avatarUrl} className="w-12 h-12 rounded-full object-cover" alt={agent.label} />
                    ) : (
                      agent?.emoji || '💬'
                    )}
                  </div>
                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[15px] text-gray-900 truncate">{title}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2 tabular-nums">{time}</span>
                    </div>
                    <p className="text-[13px] text-gray-500 truncate mt-0.5">{snippet}</p>
                  </div>
                </button>
              );
            })}
            {filteredSessions.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
              </div>
            )}
          </div>
        </aside>

        {/* Mobile overlay */}
        {leftPanelOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-20 lg:hidden"
            onClick={() => setLeftPanelOpen(false)}
          />
        )}

        {/* RIGHT PANEL — Chat Thread */}
        <section className="relative flex min-w-0 flex-1 flex-col bg-[#f0f2f5]">
          {/* Thread header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
            <button
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
              onClick={() => setLeftPanelOpen(true)}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 bg-gray-100">
              {selectedAgent?.avatarUrl ? (
                <img
                  src={selectedAgent.avatarUrl}
                  className="w-10 h-10 rounded-full object-cover"
                  alt={selectedAgent.label}
                />
              ) : (
                selectedAgent?.emoji || '💬'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 text-[15px] truncate">{currentSessionTitle}</div>
              <div className="text-xs text-gray-500 truncate">{currentSessionMeta}</div>
            </div>
            {connected && (
              <span className="inline-flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                Available
              </span>
            )}
          </div>

          {/* Error banner */}
          {gatewayError && (
            <div className="px-4 py-2 bg-red-50 text-red-600 text-sm border-b border-red-100">
              {gatewayError}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
            <div className="mx-auto max-w-3xl flex flex-col gap-3">
              {loadingHistory ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-2xl mb-4 shadow-sm">
                    {selectedAgent?.emoji || '💬'}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{currentSessionTitle}</h3>
                  <p className="text-sm text-gray-500">Send a message to start the conversation</p>
                </div>
              ) : (
                messages.map((msg) =>
                  msg.role === 'user' ? (
                    <UserBubble key={msg.id} msg={msg} />
                  ) : msg.role === 'assistant' ? (
                    <AssistantBubble
                      key={msg.id}
                      msg={msg}
                      label={selectedAgent?.label || 'Agent'}
                      emoji={selectedAgent?.emoji || '✨'}
                    />
                  ) : (
                    <SystemBubble key={msg.id} msg={msg} />
                  ),
                )
              )}
              {chatBusy && (
                <TypingBubble label={selectedAgent?.label || 'Agent'} emoji={selectedAgent?.emoji || '✨'} />
              )}
              <div ref={endRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white px-3 py-3 safe-bottom">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-end gap-2 bg-white rounded-2xl border border-gray-200 p-2 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50 transition-all">
                <textarea
                  ref={textareaRef}
                  className="flex-1 resize-none border-0 bg-transparent text-[15px] text-gray-900 placeholder-gray-400 outline-none px-2 py-1.5 max-h-[160px]"
                  placeholder={connected ? `Message ${selectedAgent?.label || 'agent'}...` : 'Gateway offline...'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={1}
                  disabled={!connected}
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!inputValue.trim() || !connected || chatBusy}
                  className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-blue-500 text-white disabled:bg-gray-200 disabled:text-gray-400 transition-colors hover:bg-blue-600"
                >
                  {chatBusy && streamingRunId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="flex justify-between items-center mt-1.5 px-2 text-[11px] text-gray-400">
                <span>
                  {selectedAgent?.label || 'Agent'} •{' '}
                  {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
                <span className="hidden sm:inline">Enter to send • Shift+Enter for new line</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Chat;
