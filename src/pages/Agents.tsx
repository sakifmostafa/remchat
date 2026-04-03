import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAgents,
  updateAgent,
  fetchAgentHealth,
  fetchAgentIdentityFile,
  saveAgentIdentityFile,
  type Agent as ApiAgent,
  type AgentHealth as ApiAgentHealth,
} from '@/lib/admin-api';
import PageHeader from '@/components/PageHeader';
import {
  Settings,
  Activity,
  FileText,
  Save,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';

type Agent = ApiAgent & {
  agent_type?: 'MAIN' | 'CODING' | 'RESEARCH' | 'SPECIALIST' | string;
  display_name?: string;
  model?: string;
  provider?: string;
  enabled?: boolean;
  description?: string;
  status?: 'running' | 'idle' | 'crashed' | 'stopped' | string;
  uptime?: number;
};

type AgentHealth = ApiAgentHealth;

type TabType = 'SOUL.md' | 'MEMORY.md' | 'config';

const statusConfig = {
  running: { color: 'bg-green-500', label: 'Running' },
  idle: { color: 'bg-yellow-500', label: 'Idle' },
  crashed: { color: 'bg-red-500', label: 'Crashed' },
  stopped: { color: 'bg-gray-400', label: 'Stopped' },
};

const typeConfig = {
  MAIN: { bg: 'bg-oxblood', text: 'text-white' },
  CODING: { bg: 'bg-blue-600', text: 'text-white' },
  RESEARCH: { bg: 'bg-purple-600', text: 'text-white' },
  SPECIALIST: { bg: 'bg-amber-500', text: 'text-white' },
};

export default function Agents() {
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('SOUL.md');
  const [identityContent, setIdentityContent] = useState('');
  const [configData, setConfigData] = useState({
    model: '',
    enabled: false,
    description: '',
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Close modal on Escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setSelectedAgent(null);
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [selectedAgent, handleEscape]);

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  });

  const { data: healthData = [] } = useQuery({
    queryKey: ['agentHealth'],
    queryFn: fetchAgentHealth,
    refetchInterval: 30000,
  });

  const saveIdentityMutation = useMutation({
    mutationFn: ({
      agentName,
      filename,
      content,
    }: {
      agentName: string;
      filename: string;
      content: string;
    }) => saveAgentIdentityFile(agentName, filename, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setSaveSuccess(true);
      setSaveError(null);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
    onError: (err: Error) => {
      setSaveError(err.message || 'Failed to save');
      setTimeout(() => setSaveError(null), 4000);
    },
  });

  const updateAgentMutation = useMutation({
    mutationFn: ({ name, data }: { name: string; data: Partial<Agent> }) =>
      updateAgent(name, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agentHealth'] });
      setSaveSuccess(true);
      setSaveError(null);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
    onError: (err: Error) => {
      setSaveError(err.message || 'Failed to update agent');
      setTimeout(() => setSaveError(null), 4000);
    },
  });

  const openAgentDetail = async (agent: Agent) => {
    setSelectedAgent(agent);
    setActiveTab('SOUL.md');
    setConfigData({
      model: agent.model || '',
      enabled: agent.enabled ?? true,
      description: agent.description || '',
    });

    try {
      const content = await fetchAgentIdentityFile(agent.name, 'SOUL.md');
      setIdentityContent(content);
    } catch {
      setIdentityContent('# SOUL.md\n\nNo content available.');
    }
  };

  const handleTabChange = async (tab: TabType) => {
    setActiveTab(tab);
    if (selectedAgent && tab !== 'config') {
      try {
        const content = await fetchAgentIdentityFile(selectedAgent.name, tab);
        setIdentityContent(content);
      } catch {
        setIdentityContent(`# ${tab}\n\nNo content available.`);
      }
    }
  };

  const handleSaveIdentity = () => {
    if (!selectedAgent) return;
    saveIdentityMutation.mutate({
      agentName: selectedAgent.name,
      filename: activeTab,
      content: identityContent,
    });
  };

  const handleSaveConfig = () => {
    if (!selectedAgent) return;
    updateAgentMutation.mutate({
      name: selectedAgent.name,
      data: configData,
    });
  };

  const isSaving = saveIdentityMutation.isPending || updateAgentMutation.isPending;

  const getHealthForAgent = (agentName: string): AgentHealth | undefined => {
    return healthData.find((h) => h.name === agentName);
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="min-h-screen bg-beige">
      <PageHeader
        title="Agent Management"
        description="Monitor and configure your AI agents"
        action={
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['agents'] })}
            className="flex items-center gap-2 px-4 py-2 bg-oxblood text-white rounded-lg hover:bg-oxblood/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      <div className="p-6">
        {agentsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-cream rounded-xl p-6 animate-pulse"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-300 rounded-full" />
                  <div className="flex-1">
                    <div className="h-5 bg-gray-300 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-300 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => {
              const health = getHealthForAgent(agent.name);
              const status = health?.status || agent.status || 'stopped';
              const statusStyle = statusConfig[status as keyof typeof statusConfig] || statusConfig.stopped;
              const typeStyle = typeConfig[agent.agent_type as keyof typeof typeConfig] || typeConfig.SPECIALIST;
              const displayName = agent.display_name || agent.name;
              const provider = agent.provider || 'Unknown';
              const model = agent.model || 'Unknown';
              const enabled = agent.enabled ?? true;

              return (
                <div
                  key={agent.name}
                  onClick={() => openAgentDetail(agent)}
                  className="bg-cream rounded-xl p-6 cursor-pointer hover:shadow-lg hover:shadow-oxblood/10 transition-all border border-beige hover:border-oxblood/30"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-oxblood rounded-full flex items-center justify-center text-white text-xl font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {displayName}
                        </h3>
                        <div className={`w-2 h-2 rounded-full ${statusStyle.color}`} />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${typeStyle.bg} ${typeStyle.text}`}
                        >
                          {agent.agent_type || 'SPECIALIST'}
                        </span>
                        <span className="text-xs text-gray-500">{provider}</span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{model}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-beige flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Activity className="w-3 h-3" />
                      <span>{health?.active_tasks || 0} tasks</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatUptime(health?.uptime || agent.uptime || 0)}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateAgentMutation.mutate({
                            name: agent.name,
                            data: { enabled: !enabled },
                          });
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-oxblood/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-oxblood"></div>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedAgent(null); }}
        >
          <div className="bg-cream rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-oxblood text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
                    {(selectedAgent.display_name || selectedAgent.name).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedAgent.display_name || selectedAgent.name}</h2>
                    <p className="text-white/80 text-sm">{selectedAgent.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Status badges */}
              <div className="flex items-center gap-3 mt-4">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
                    statusConfig[selectedAgent.status as keyof typeof statusConfig]?.color ||
                    'bg-gray-400'
                  } text-white`}
                >
                  {selectedAgent.status === 'running' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : selectedAgent.status === 'crashed' ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                  {statusConfig[selectedAgent.status as keyof typeof statusConfig]?.label ||
                    selectedAgent.status || 'Stopped'}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    typeConfig[selectedAgent.agent_type as keyof typeof typeConfig]?.bg || 'bg-gray-500'
                  } text-white`}
                >
                  {selectedAgent.agent_type || 'SPECIALIST'}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-beige bg-cream">
              <div className="flex">
                <button
                  onClick={() => handleTabChange('SOUL.md')}
                  className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === 'SOUL.md'
                      ? 'border-oxblood text-oxblood'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  SOUL.md
                </button>
                <button
                  onClick={() => handleTabChange('MEMORY.md')}
                  className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === 'MEMORY.md'
                      ? 'border-oxblood text-oxblood'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  MEMORY.md
                </button>
                <button
                  onClick={() => handleTabChange('config')}
                  className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === 'config'
                      ? 'border-oxblood text-oxblood'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Configuration
                </button>
              </div>
            </div>

            {/* Feedback */}
            {saveSuccess && (
              <div className="mx-6 mt-4 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                Saved successfully.
              </div>
            )}
            {saveError && (
              <div className="mx-6 mt-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {saveError}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {activeTab === 'config' ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Model
                    </label>
                    <input
                      type="text"
                      value={configData.model}
                      onChange={(e) =>
                        setConfigData({ ...configData, model: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-oxblood/50 focus:border-oxblood outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={configData.description}
                      onChange={(e) =>
                        setConfigData({ ...configData, description: e.target.value })
                      }
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-oxblood/50 focus:border-oxblood outline-none resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configData.enabled}
                        onChange={(e) =>
                          setConfigData({ ...configData, enabled: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-oxblood/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-oxblood"></div>
                    </label>
                    <span className="text-sm font-medium text-gray-700">Enabled</span>
                  </div>

                  {/* Health Section */}
                  <div className="mt-8 pt-6 border-t border-beige">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-oxblood" />
                      Health Status
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white p-4 rounded-lg border border-beige">
                        <p className="text-sm text-gray-500 mb-1">Uptime</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatUptime(
                            getHealthForAgent(selectedAgent.name)?.uptime ||
                              selectedAgent.uptime ||
                              0
                          )}
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-beige">
                        <p className="text-sm text-gray-500 mb-1">Restarts</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {getHealthForAgent(selectedAgent.name)?.restart_count || 0}
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-beige">
                        <p className="text-sm text-gray-500 mb-1">Active Tasks</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {getHealthForAgent(selectedAgent.name)?.active_tasks || 0}
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-beige">
                        <p className="text-sm text-gray-500 mb-1">Status</p>
                        <p className="text-lg font-semibold text-gray-900 capitalize">
                          {getHealthForAgent(selectedAgent.name)?.status || selectedAgent.status}
                        </p>
                      </div>
                    </div>
                    {getHealthForAgent(selectedAgent.name)?.last_error && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm font-medium text-red-800 mb-1">Last Error</p>
                        <p className="text-sm text-red-600">
                          {getHealthForAgent(selectedAgent.name)?.last_error}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSaveConfig}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-3 bg-oxblood text-white rounded-lg hover:bg-oxblood/90 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {activeTab === 'SOUL.md' ? 'Agent Soul' : 'Agent Memory'}
                    </h3>
                    <button
                      onClick={handleSaveIdentity}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-oxblood text-white rounded-lg hover:bg-oxblood/90 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <textarea
                    value={identityContent}
                    onChange={(e) => setIdentityContent(e.target.value)}
                    className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm bg-white focus:ring-2 focus:ring-oxblood/50 focus:border-oxblood outline-none resize-none"
                    placeholder="Loading..."
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
