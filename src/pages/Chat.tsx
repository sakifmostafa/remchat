import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  X,
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
    // Remove tool call blocks
    .replace(/```tool_use[\s\S]*?```/g, '')
    .replace(/```tool_result[\s\S]*?```/g, '')
    .replace(/```tool_call[\s\S]*?```/g, '')
    // Remove JSON objects with tool-related keys
    .replace(/\{[\s\S]*?"type"\s*:\s*"tool_[^"]*"[\s\S]*?\}/g, '')
    .replace(/\{[\s\S]*?"tool_use"[\s\S]*?\}/g, '')
    .replace(/\{[\s\S]*?"tool_result"[\s\S]*?\}/g, '')
    .replace(/\{[\s\S]*?"tool_call_id"[\s\S]*?\}/g, '')
    .replace(/\{[\s\S]*?"tool_name"[\s\S]*?\}/g, '')
    .replace(/\{[\s\S]*?"embedding"[\s\S]*?\}/g, '')
    // Remove standalone tool/embedding JSON blobs (compact form)
    .replace(/\{"[^"]*":\s*\{?\s*"[^"]*"\s*:\s*"[^"]*"\s*\}?}/g, '')
    // Remove embedding/number arrays like [0.123, -0.456, ...] or [[0.1, ...], ...]
    .replace(/\[\s*-?\d+\.?\d*\s*(,\s*-?\d+\.?\d*\s*)*\]/g, '')
    // Remove lines that are just numbers or vectors
    .replace(/^[\s\d.,\-]+$/gm, '')
    // Remove metadata tags
    .replace(/^\[[^\]]+\]\s*/gm, '')
    .trim();
}

function sanitizeMessageText(message: GatewayChatMessage | undefined): string {
  return stripInboundMetadata(resolveSessionText(message));
}

function mapHistoryMessage(message: GatewayChatMessage, index: number): UiMessage | null {
  const role = message.role === 'user' ? 'user' : message.role === 'assistant' ? 'assistant' : 'system';
  const content = sanitizeMessageText(message);
  
  // Skip empty content
  if (!content) {
    return null;
  }
  
  // Skip system messages that look like tool output
  if (role === 'system') {
    const toolPatterns = [
      /tool_use/i,
      /tool_result/i,
      /tool_call/i,
      /embedding/i,
      /"type"\s*:\s*"tool/i,
      /"tool_name"/i,
      /"tool_call_id"/i,
      /\[-?\d+\.?\d*,?\s*\]/i,  // array of numbers
    ];
    if (toolPatterns.some((pattern) => pattern.test(content))) {
      return null;
    }
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

function sanitizePreviewSnippet(text: string): string {
  const cleaned = stripInboundMetadata(text);
  
  // If empty, return fallback
  if (!cleaned.trim()) {
    return 'No messages yet';
  }
  
  // Check if the text is mostly JSON-like or just numbers (but not quoted prose)
  const isMostlyJson = /^\s*[\[{]/.test(cleaned) && /[\]}]\s*$/.test(cleaned);
  const isJustNumbers = /^[\s\d.,\-]+$/.test(cleaned);
  
  if (isMostlyJson || isJustNumbers) {
    // Try to extract any readable text
    const readableParts = cleaned
      .replace(/[\[\]\{\}"]/g, ' ')
      .replace(/\d+\.\d+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (readableParts.length > 10) {
      return readableParts.slice(0, 80);
    }
    
    return 'No messages yet';
  }
  
  // Truncate to 80 chars
  if (cleaned.length > 80) {
    return cleaned.slice(0, 77) + '...';
  }
  
  return cleaned;
}

function previewSnippet(preview: GatewaySessionPreviewEntry[] | undefined): string {
  const last = preview?.[preview.length - 1];
  if (!last) {
    return 'No messages yet';
  }
  return sanitizePreviewSnippet(last.text || '');
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
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  
  // Message queue for offline/busy states
  const [messageQueue, setMessageQueue] = useState<Array<{ id: string; text: string; createdAt: number }>>([]);

  const clientRef = useRef<OpenClawGatewayClient | null>(null);
  const connectedRef = useRef(false);
  const selectedSessionKeyRef = useRef(selectedSessionKey);
  const streamingRunIdRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatBusyRef = useRef(chatBusy);
  const isFlushingRef = useRef(false);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? agents[0];

  // All sessions sorted by updatedAt descending — no agent filter
  const allSessions = useMemo(
    () => [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [sessions],
  );

  // Group sessions by agent for contact-style left sidebar
  const agentContacts = useMemo(() => {
    const byAgent = new Map<string, GatewaySessionRow[]>();
    for (const session of allSessions) {
      const agentId = resolveAgentIdFromSessionKey(session.key) || 'unknown';
      const list = byAgent.get(agentId) || [];
      list.push(session);
      byAgent.set(agentId, list);
    }
    // Build contact rows: one per agent, sorted by most recent session activity
    return agents
      .map((agent) => {
        const agentSessions = byAgent.get(agent.id) || [];
        const latestSession = agentSessions[0] || null;
        const mainKey = buildAgentMainSessionKey(agent.id);
        const previewKey = latestSession?.key || mainKey;
        const preview = sessionPreviewByKey[previewKey];
        const snippet = preview?.[0]?.text ? previewSnippet(preview) : 'No messages yet';
        const updatedAt = latestSession?.updatedAt || null;
        return { agent, sessions: agentSessions, latestSession, snippet, updatedAt, mainKey };
      })
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [allSessions, agents, sessionPreviewByKey]);

  // Search filter (searches agent names)
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return agentContacts;
    const q = searchQuery.toLowerCase();
    return agentContacts.filter(
      (c) => c.agent.name.toLowerCase().includes(q) || c.agent.label.toLowerCase().includes(q),
    );
  }, [agentContacts, searchQuery]);

  // Sessions for the currently selected agent (for the header dropdown)
  const currentAgentSessions = useMemo(() => {
    return allSessions.filter(
      (s) => resolveAgentIdFromSessionKey(s.key) === selectedAgentId,
    );
  }, [allSessions, selectedAgentId]);

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
    chatBusyRef.current = chatBusy;
  }, [chatBusy]);

  // Ref for synchronous queue access inside callbacks
  const messageQueueRef = useRef(messageQueue);
  useEffect(() => {
    messageQueueRef.current = messageQueue;
  }, [messageQueue]);

  // Flush queue when connected and not busy
  const flushQueue = useCallback(async () => {
    if (isFlushingRef.current) return;
    if (!connectedRef.current || chatBusyRef.current) return;

    const client = clientRef.current;
    if (!client) return;

    const currentQueue = messageQueueRef.current;
    if (!currentQueue || currentQueue.length === 0) return;

    const [firstMessage, ...rest] = currentQueue;
    isFlushingRef.current = true;

    // Update queue immediately (remove first item)
    messageQueueRef.current = rest;
    setMessageQueue([...rest]);

    // Add user message to UI immediately
    const userMessage: UiMessage = {
      id: firstMessage.id,
      role: 'user',
      content: firstMessage.text,
      timestamp: firstMessage.createdAt,
    };
    setMessages((previous) => [...previous, userMessage]);
    setChatBusy(true);
    setGatewayError(null);

    const runId = messageId();
    setStreamingRunId(runId);

    client
      .request('chat.send', {
        sessionKey: selectedSessionKeyRef.current,
        message: firstMessage.text,
        deliver: false,
        idempotencyKey: runId,
      })
      .then(() => {
        const previewClient = clientRef.current;
        if (previewClient && connectedRef.current) {
          previewClient.request('sessions.preview', {
            keys: [selectedSessionKeyRef.current],
            limit: 1,
            maxChars: 160,
          }).then((result: unknown) => {
            const res = result as SessionPreviewResult;
            const next: Record<string, GatewaySessionPreviewEntry[]> = {};
            for (const item of res.previews || []) {
              next[item.key] = item.items || [];
            }
            setSessionPreviewByKey((previous) => ({ ...previous, ...next }));
          }).catch(() => {});
        }
      })
      .catch((error) => {
        setChatBusy(false);
        setStreamingRunId(null);
        setGatewayError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        isFlushingRef.current = false;
      });
  }, []);

  // Watch connected and chatBusy to flush queue
  useEffect(() => {
    if (connected && !chatBusy) {
      void flushQueue();
    }
  }, [connected, chatBusy, flushQueue]);

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
    if (!client || !text) {
      return;
    }

    // Queue message if offline or busy
    if (!connected || chatBusy) {
      const queuedMessage = {
        id: messageId(),
        text,
        createdAt: Date.now(),
      };
      setMessageQueue((previous) => [...previous, queuedMessage]);
      setInputValue('');
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
                onClick={() => void startNewChat(selectedAgentId)}
                disabled={!connected || creatingSession}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                title="New chat"
              >
                {creatingSession ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
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

          {/* Agent contact list — one row per agent */}
          <div className="flex-1 overflow-y-auto">
            {filteredContacts.map((contact) => {
              const isActive = contact.agent.id === selectedAgentId;
              const time = contact.updatedAt ? formatInboxTimestamp(contact.updatedAt) : '';
              const sessionCount = contact.sessions.length;

              return (
                <button
                  key={contact.agent.id}
                  onClick={() => {
                    setSelectedAgentId(contact.agent.id);
                    setSelectedSessionKey(contact.mainKey);
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
                    {contact.agent.avatarUrl ? (
                      <img src={contact.agent.avatarUrl} className="w-12 h-12 rounded-full object-cover" alt={contact.agent.label} />
                    ) : (
                      contact.agent.emoji || '💬'
                    )}
                  </div>
                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[15px] text-gray-900 truncate">{contact.agent.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2 tabular-nums">{time}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[13px] text-gray-500 truncate flex-1">{contact.snippet}</p>
                      {sessionCount > 1 && (
                        <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {sessionCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredContacts.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                {searchQuery ? 'No matching agents' : 'No agents yet'}
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
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-[15px] truncate">{currentSessionTitle}</span>
                {/* Sessions dropdown — switch between this agent's sessions */}
                {currentAgentSessions.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500"
                      title={`${currentAgentSessions.length} sessions`}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span className="text-[11px] tabular-nums">{currentAgentSessions.length}</span>
                    </button>
                    {agentDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setAgentDropdownOpen(false)}
                        />
                        <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden">
                          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500">
                              {selectedAgent?.name || 'Agent'} Sessions
                            </span>
                            <button
                              onClick={() => {
                                setAgentDropdownOpen(false);
                                void startNewChat(selectedAgentId);
                              }}
                              disabled={!connected || creatingSession}
                              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 disabled:opacity-40"
                            >
                              <Plus className="w-3 h-3" />
                              New
                            </button>
                          </div>
                          <div className="max-h-64 overflow-y-auto py-1">
                            {currentAgentSessions.map((session) => {
                              const isActive = session.key === selectedSessionKey;
                              const title = buildSessionTitle(session, selectedAgent);
                              const meta = buildSessionMeta(session, channelsSnapshot);
                              const time = session.updatedAt ? formatInboxTimestamp(session.updatedAt) : '';
                              return (
                                <button
                                  key={session.key}
                                  onClick={() => {
                                    setSelectedSessionKey(session.key);
                                    setAgentDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors ${
                                    isActive ? 'bg-blue-50' : ''
                                  }`}
                                >
                                  <div className="flex-1 text-left min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">{title}</div>
                                    <div className="text-xs text-gray-400 truncate">{meta}</div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-[11px] text-gray-400 tabular-nums">{time}</span>
                                    {isActive && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 truncate">{currentSessionMeta}</div>
            </div>
            {connected ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                Available
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                Offline
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

          {/* Message queue */}
          {messageQueue.length > 0 && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
              <div className="mx-auto max-w-3xl">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-500">
                    Queued ({messageQueue.length})
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {messageQueue.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 shadow-sm border border-gray-100"
                    >
                      <span className="flex-1 text-sm text-gray-700 truncate">
                        {msg.text.length > 60 ? msg.text.slice(0, 57) + '...' : msg.text}
                      </span>
                      <button
                        onClick={() => setMessageQueue((prev) => prev.filter((m) => m.id !== msg.id))}
                        className="flex-shrink-0 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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
                  disabled={!inputValue.trim() || !connected}
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
