export type RuntimeGatewayConfig = {
  gatewayToken?: string;
  gatewayUrl?: string;
  uiPassword?: string;
};

export type GatewayAgent = {
  id: string;
  name?: string;
  identity?: {
    name?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
};

export type AgentsListResult = {
  defaultId: string;
  mainKey: string;
  scope: string;
  agents: GatewayAgent[];
};

export type GatewaySessionRow = {
  key: string;
  kind: 'direct' | 'group' | 'global' | 'unknown';
  label?: string;
  displayName?: string;
  surface?: string;
  subject?: string;
  room?: string;
  space?: string;
  updatedAt: number | null;
  status?: 'running' | 'done' | 'failed' | 'killed' | 'timeout';
};

export type SessionsListResult = {
  ts: number;
  path: string;
  count: number;
  defaults: {
    modelProvider: string | null;
    model: string | null;
    contextTokens: number | null;
  };
  sessions: GatewaySessionRow[];
};

export type GatewaySessionPreviewEntry = {
  role?: string;
  text?: string;
  timestamp?: number;
};

export type ChannelsStatusSnapshot = {
  ts: number;
  channelOrder: string[];
  channelLabels: Record<string, string>;
};

export type GatewayChatHistoryResult = {
  messages?: GatewayChatMessage[];
};

export type GatewayChatMessage = {
  role?: string;
  text?: string;
  timestamp?: number;
  content?: Array<
    | { type?: 'text'; text?: string }
    | { type?: 'image'; source?: unknown }
    | Record<string, unknown>
  >;
};

export type GatewayChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: GatewayChatMessage;
  errorMessage?: string;
};

type GatewayEventFrame = {
  type: 'event';
  event: string;
  payload?: unknown;
};

type GatewayResponseFrame = {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

export type OpenClawGatewayClientOptions = {
  url: string;
  token: string;
  onEvent?: (event: GatewayEventFrame) => void;
  onOpen?: () => void;
  onClose?: (reason: string) => void;
};

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function defaultGatewayUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/openclaw`;
}

export function resolveGatewayUrl(config: RuntimeGatewayConfig | null): string {
  return config?.gatewayUrl?.trim() || defaultGatewayUrl();
}

export async function loadRuntimeGatewayConfig(): Promise<RuntimeGatewayConfig | null> {
  try {
    const response = await fetch('/openclaw-config.json', { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as RuntimeGatewayConfig;
  } catch {
    return null;
  }
}

export function resolveSessionText(message: GatewayChatMessage | undefined): string {
  if (!message) {
    return '';
  }
  if (typeof message.text === 'string' && message.text.trim()) {
    return message.text;
  }
  if (!Array.isArray(message.content)) {
    return '';
  }
  return message.content
    .map((part) => (part && part.type === 'text' && typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

export function resolveAgentIdFromSessionKey(sessionKey: string): string | null {
  const parts = sessionKey.split(':');
  if (parts.length < 3 || parts[0] !== 'agent') {
    return null;
  }
  return parts[1] || null;
}

export function buildAgentMainSessionKey(agentId: string): string {
  return `agent:${agentId}:main`;
}

export class OpenClawGatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private connectSent = false;
  private connectTimer: number | null = null;
  private handshakeReady = false;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((error: Error) => void) | null = null;

  constructor(private readonly options: OpenClawGatewayClientOptions) {}

  start() {
    this.stop();
    this.handshakeReady = false;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.ws = new WebSocket(this.options.url);
    this.ws.addEventListener('open', () => {
      this.queueConnect();
    });
    this.ws.addEventListener('message', (event) => {
      this.handleMessage(String(event.data ?? ''));
    });
    this.ws.addEventListener('close', (event) => {
      this.handshakeReady = false;
      this.rejectReady?.(new Error(`gateway closed (${event.code}) ${event.reason || ''}`));
      this.resolveReady = null;
      this.rejectReady = null;
      this.flushPending(new Error(`gateway closed (${event.code}) ${event.reason || ''}`));
      this.options.onClose?.(`${event.code}${event.reason ? ` ${event.reason}` : ''}`);
    });
  }

  stop() {
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.connectSent = false;
    this.handshakeReady = false;
    this.rejectReady?.(new Error('gateway client stopped'));
    this.resolveReady = null;
    this.rejectReady = null;
    this.readyPromise = null;
    this.ws?.close();
    this.ws = null;
    this.flushPending(new Error('gateway client stopped'));
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.handshakeReady;
  }

  async whenReady(): Promise<void> {
    await this.readyPromise;
  }

  async request<T>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('gateway not connected');
    }
    if (method !== 'connect' && !this.handshakeReady) {
      await this.whenReady();
    }
    const id = generateId();
    const frame = { type: 'req', id, method, params };
    const pending = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
    });
    this.ws.send(JSON.stringify(frame));
    return pending;
  }

  private queueConnect() {
    this.connectSent = false;
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    void this.sendConnect();
  }

  private async sendConnect() {
    if (this.connectSent) {
      return;
    }
    this.connectSent = true;
    try {
      await this.request('connect', {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'openclaw-control-ui',
          version: 'rem-admin-native-chat',
          platform: navigator.platform || 'web',
          mode: 'ui',
          instanceId: generateId(),
        },
        role: 'operator',
        scopes: [
          'operator.admin',
          'operator.read',
          'operator.write',
          'operator.approvals',
          'operator.pairing',
        ],
        caps: ['tool-events'],
        auth: {
          token: this.options.token,
        },
        userAgent: navigator.userAgent,
        locale: navigator.language,
      });
      this.handshakeReady = true;
      this.resolveReady?.();
      this.resolveReady = null;
      this.rejectReady = null;
      this.options.onOpen?.();
    } catch (error) {
      this.handshakeReady = false;
      this.rejectReady?.(error instanceof Error ? error : new Error(String(error)));
      this.resolveReady = null;
      this.rejectReady = null;
      throw error;
    }
  }

  private handleMessage(raw: string) {
    let parsed: GatewayEventFrame | GatewayResponseFrame | null = null;
    try {
      parsed = JSON.parse(raw) as GatewayEventFrame | GatewayResponseFrame;
    } catch {
      return;
    }

    if (!parsed) {
      return;
    }

    if (parsed.type === 'event') {
      if (parsed.event === 'connect.challenge') {
        void this.sendConnect();
        return;
      }
      this.options.onEvent?.(parsed);
      return;
    }

    if (parsed.type === 'res') {
      const pending = this.pending.get(parsed.id);
      if (!pending) {
        return;
      }
      this.pending.delete(parsed.id);
      if (parsed.ok) {
        pending.resolve(parsed.payload);
      } else {
        pending.reject(new Error(parsed.error?.message || 'gateway request failed'));
      }
    }
  }

  private flushPending(error: Error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}
