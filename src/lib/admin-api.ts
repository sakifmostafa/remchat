const ADMIN_STORAGE_KEY = 'admin_api_key';

// Auth functions
export function getAdminKey(): string | null {
  return localStorage.getItem(ADMIN_STORAGE_KEY);
}

export function setAdminKey(key: string): void {
  localStorage.setItem(ADMIN_STORAGE_KEY, key);
}

export function clearAdminKey(): void {
  localStorage.removeItem(ADMIN_STORAGE_KEY);
}

// API base function
async function request<T>(path: string, key: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': key,
      ...options?.headers,
    },
  });

  if (response.status === 401) {
    clearAdminKey();
    window.location.reload();
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const key = getAdminKey();
  if (!key) {
    throw new Error('No admin key found');
  }

  return request<T>(path, key, options);
}

// Types
export interface Stats {
  uptime: string;
  memoryCount: number;
  taskCount: number;
  toolCount: number;
}

export interface Agent {
  name: string;
  display_name?: string;
  agent_type?: 'MAIN' | 'CODING' | 'RESEARCH' | 'SPECIALIST' | string;
  model?: string;
  provider?: string;
  enabled?: boolean;
  capabilities?: string[];
  soul_path?: string;
  memory_path?: string;
  description?: string;
  status?: 'running' | 'idle' | 'crashed' | 'stopped' | string;
  uptime?: number;
  config: Record<string, unknown>;
  health?: {
    status: string;
    uptime?: number;
    memory?: number;
    last_error?: string;
  };
}

export interface AgentHealth {
  name: string;
  status: string;
  uptime: number;
  memory?: number;
  restart_count?: number;
  last_error?: string | null;
  active_tasks?: number;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
  schedule_value?: string;
  action?: string;
}

export interface Memory {
  id: string;
  content: string;
  category: string;
  timestamp: string;
  tags?: string[];
}

export interface JournalEntry {
  id: string;
  section: string;
  content: string;
  timestamp: string;
  type: string;
  createdAt: string;
  mood?: string;
  tags?: string[];
}

export interface Activity {
  id: string;
  type: string;
  timestamp: string;
  details: Record<string, unknown>;
  user?: string;
}

export interface ActivityResponse {
  items: Activity[];
  total: number;
  page: number;
}

export interface Setting {
  key: string;
  value: unknown;
  type: 'boolean' | 'number' | 'string';
  description?: string;
}

export interface SettingsResponse {
  settings: Record<string, unknown>;
  mutable_fields: string[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  module?: string;
  stack?: string;
  [key: string]: unknown;
}

export interface LogsResponse {
  logs: LogEntry[];
}

export interface ChatResponse {
  response: string;
}

// API Methods

// Stats
export async function fetchStats(): Promise<Stats> {
  const raw = await api<{
    uptime?: string | number;
    memory_count?: number;
    task_count?: number;
    tool_count?: number;
  }>('/api/admin/stats');

  return {
    uptime: String(raw.uptime ?? '--'),
    memoryCount: raw.memory_count ?? 0,
    taskCount: raw.task_count ?? 0,
    toolCount: raw.tool_count ?? 0,
  };
}

// Agents
export async function fetchAgents(): Promise<Agent[]> {
  return api<Agent[]>('/api/agents');
}

export async function updateAgent(name: string, data: Record<string, unknown>): Promise<{ success: boolean; message?: string }> {
  return api<{ success: boolean; message?: string }>(`/api/agents/${name}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function fetchAgentHealth(): Promise<AgentHealth[]> {
  const response = await api<{ agents?: AgentHealth[] } | AgentHealth[]>('/api/agents/health');
  return Array.isArray(response) ? response : response.agents ?? [];
}

export async function fetchAgentIdentityFile(agentName: string, filename: string): Promise<string> {
  const response = await api<{ content: string }>(`/api/admin/agent-identity/${agentName}/${filename}`);
  return response.content;
}

export async function saveAgentIdentityFile(
  agentName: string,
  filename: string,
  content: string
): Promise<{ success: boolean; message?: string }> {
  return api<{ success: boolean; message?: string }>(`/api/admin/agent-identity/${agentName}/${filename}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

// Identity
export async function fetchIdentityFile(file: string): Promise<string> {
  const response = await api<{ content: string }>(`/api/admin/identity/${file}`);
  return response.content;
}

export async function saveIdentityFile(
  file: string,
  content: string
): Promise<{ success: boolean; message?: string }> {
  return api<{ success: boolean; message?: string }>(`/api/admin/identity/${file}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

// Skills
export async function fetchSkills(): Promise<Array<{ name: string; description?: string }>> {
  return api<Array<{ name: string; description?: string }>>('/api/admin/skills');
}

export async function loadSkill(name: string): Promise<string> {
  const response = await api<{ content: string }>(`/api/admin/skills/${name}`);
  return response.content;
}

// Cron
export async function fetchCronJobs(): Promise<CronJob[]> {
  const response = await api<{ jobs: Array<Record<string, unknown>> }>('/api/cron/jobs');
  
  return response.jobs.map((job, index) => ({
    id: String(job.id || index),
    name: String(job.name || job.id || `Job ${index + 1}`),
    schedule: String(job.schedule || job.schedule_value || ''),
    command: String(job.command || job.action || ''),
    enabled: Boolean(job.enabled ?? true),
    last_run: job.last_run ? String(job.last_run) : undefined,
    next_run: job.next_run ? String(job.next_run) : undefined,
    schedule_value: job.schedule_value ? String(job.schedule_value) : undefined,
    action: job.action ? String(job.action) : undefined,
  }));
}

export async function createCronJob(data: Partial<CronJob>): Promise<{ success: boolean; job?: CronJob }> {
  const response = await api<{ success: boolean; job?: Record<string, unknown> }>('/api/cron/jobs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  return {
    success: response.success,
    job: response.job ? {
      id: String(response.job.id || ''),
      name: String(response.job.name || ''),
      schedule: String(response.job.schedule || ''),
      command: String(response.job.command || ''),
      enabled: Boolean(response.job.enabled ?? true),
    } : undefined,
  };
}

export async function updateCronJob(
  id: string,
  data: Partial<CronJob>
): Promise<{ success: boolean; message?: string }> {
  return api<{ success: boolean; message?: string }>(`/api/cron/jobs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCronJob(id: string): Promise<{ success: boolean; message?: string }> {
  return api<{ success: boolean; message?: string }>(`/api/cron/jobs/${id}`, {
    method: 'DELETE',
  });
}

// Memories
export async function fetchMemories(search?: string, category?: string): Promise<Memory[]> {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (category) params.append('category', category);
  
  const queryString = params.toString();
  const url = queryString ? `/api/admin/memories?${queryString}` : '/api/admin/memories';
  
  return api<Memory[]>(url);
}

export async function deleteMemory(id: string): Promise<{ success: boolean }> {
  return api<{ success: boolean }>(`/api/admin/memories/${id}`, {
    method: 'DELETE',
  });
}

// Journal
export async function fetchJournalEntries(section?: string, limit?: number): Promise<JournalEntry[]> {
  const params = new URLSearchParams();
  if (section) params.append('section', section);
  if (limit) params.append('limit', String(limit));
  
  const queryString = params.toString();
  const url = queryString ? `/api/journal/entries?${queryString}` : '/api/journal/entries';
  
  const entries = await api<Array<Partial<JournalEntry>>>(url);

  return entries.map((entry, index) => ({
    id: String(entry.id ?? index),
    section: String(entry.section ?? entry.type ?? 'daily'),
    content: String(entry.content ?? ''),
    timestamp: String(entry.timestamp ?? entry.createdAt ?? ''),
    type: String(entry.type ?? entry.section ?? 'daily'),
    createdAt: String(entry.createdAt ?? entry.timestamp ?? ''),
    mood: entry.mood ? String(entry.mood) : undefined,
    tags: Array.isArray(entry.tags) ? entry.tags.map(String) : undefined,
  }));
}

// Activity
export async function fetchActivity(page?: number, type?: string): Promise<ActivityResponse> {
  const params = new URLSearchParams();
  if (page) params.append('page', String(page));
  if (type) params.append('type', type);
  
  const queryString = params.toString();
  const url = queryString ? `/api/admin/activity?${queryString}` : '/api/admin/activity';
  
  const response = await api<{ activities: Activity[]; total: number }>(url);
  
  return {
    items: response.activities || [],
    total: response.total || 0,
    page: page || 1,
  };
}

// Settings
export async function fetchSettings(): Promise<SettingsResponse> {
  const response = await api<SettingsResponse | Record<string, unknown>>('/api/admin/settings');
  
  // Handle both formats
  if ('settings' in response && 'mutable_fields' in response) {
    return response as SettingsResponse;
  }
  
  // Fallback: assume the response itself is the settings object
  return {
    settings: response as Record<string, unknown>,
    mutable_fields: [],
  };
}

export async function updateSettings(data: Record<string, unknown>): Promise<{ success: boolean; message?: string }> {
  return api<{ success: boolean; message?: string }>('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Logs
export async function fetchLogs(level?: string): Promise<LogsResponse> {
  const url = level ? `/api/admin/logs?level=${level}` : '/api/admin/logs';
  const response = await api<{ logs: LogEntry[] }>(url);
  
  return {
    logs: (response.logs || []).map((log) => ({
      ...log,
      module: log.module || (log as unknown as { log_module?: string }).log_module,
    })),
  };
}

export async function validateAdminKey(key: string): Promise<void> {
  await request('/api/admin/stats', key);
}

// Chat
export async function sendChat(message: string): Promise<ChatResponse> {
  return api<ChatResponse>('/api/admin/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export interface ChatStreamEvent {
  token?: string;
  done?: boolean;
  full_response?: string;
  error?: string;
}

export async function sendChatStream(
  message: string,
  onToken: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const key = getAdminKey();
  if (!key) throw new Error('No admin key found');

  const response = await fetch('/api/admin/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': key,
    },
    body: JSON.stringify({ message }),
    signal,
  });

  if (response.status === 401) {
    clearAdminKey();
    window.location.reload();
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        try {
          const event: ChatStreamEvent = JSON.parse(trimmed.slice(6));
          onToken(event);
        } catch {
          // skip malformed events
        }
      }
    }
  }
}

// RemTasks
export async function changeRemTasksPassword(password: string): Promise<{ success: boolean; message?: string }> {
  return api<{ success: boolean; message?: string }>('/api/admin/remtasks-password', {
    method: 'PUT',
    body: JSON.stringify({ password }),
  });
}

// Default export with all methods
const adminApi = {
  getAdminKey,
  setAdminKey,
  clearAdminKey,
  validateAdminKey,
  fetchStats,
  fetchAgents,
  updateAgent,
  fetchAgentHealth,
  fetchAgentIdentityFile,
  saveAgentIdentityFile,
  fetchIdentityFile,
  saveIdentityFile,
  fetchSkills,
  loadSkill,
  fetchCronJobs,
  createCronJob,
  updateCronJob,
  deleteCronJob,
  fetchMemories,
  deleteMemory,
  fetchJournalEntries,
  fetchActivity,
  fetchSettings,
  updateSettings,
  fetchLogs,
  sendChat,
  sendChatStream,
  changeRemTasksPassword,
};

export default adminApi;
