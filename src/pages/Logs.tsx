import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  module?: string;
  stack?: string;
  [key: string]: unknown;
}

interface LogsResponse {
  logs: LogEntry[];
}

interface LogsProps {
  api: {
    fetchLogs: (level?: string) => Promise<LogsResponse>;
  };
}

type LogLevel = 'all' | 'info' | 'warning' | 'error';

const LEVEL_FILTERS: { level: LogLevel; label: string; icon: React.ElementType }[] = [
  { level: 'all', label: 'All', icon: Info },
  { level: 'info', label: 'Info', icon: Info },
  { level: 'warning', label: 'Warning', icon: AlertTriangle },
  { level: 'error', label: 'Error', icon: AlertCircle },
];

const LEVEL_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  info: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Info },
  warning: { bg: 'bg-amber-100', text: 'text-amber-800', icon: AlertTriangle },
  error: { bg: 'bg-red-100', text: 'text-red-800', icon: AlertCircle },
  debug: { bg: 'bg-gray-100', text: 'text-gray-800', icon: Info },
  default: { bg: 'bg-gray-100', text: 'text-gray-800', icon: Info },
};

export default function Logs({ api }: LogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LogLevel>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.fetchLogs(
        levelFilter === 'all' ? undefined : levelFilter
      );
      setLogs(response.logs);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [api, levelFilter]);

  useEffect(() => {
    fetchLogs();

    if (isAutoRefresh) {
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchLogs, isAutoRefresh]);

  const handleRefresh = () => {
    fetchLogs();
  };

  const handleLevelChange = (level: LogLevel) => {
    setLevelFilter(level);
  };

  const toggleExpand = (id: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getLevelStyle = (level: string) => {
    return LEVEL_STYLES[level.toLowerCase()] || LEVEL_STYLES.default;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const errorCount = logs.filter((l) => l.level?.toLowerCase() === 'error').length;
  const warningCount = logs.filter((l) => l.level?.toLowerCase() === 'warning').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-oxblood">System Logs</h1>
          <p className="text-sm text-gray-500 mt-1">
            {logs.length} entries
            {errorCount > 0 && (
              <span className="text-red-600 ml-2">• {errorCount} errors</span>
            )}
            {warningCount > 0 && (
              <span className="text-amber-600 ml-2">• {warningCount} warnings</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={isAutoRefresh}
              onChange={(e) => setIsAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-oxblood border-gray-300 rounded focus:ring-oxblood"
            />
            Auto-refresh
          </label>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-oxblood hover:bg-oxblood/90 disabled:bg-oxblood/50 text-beige rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Level Filter */}
      <div className="bg-cream rounded-xl p-4 border border-oxblood/20">
        <div className="flex flex-wrap gap-2">
          {LEVEL_FILTERS.map(({ level, label, icon: Icon }) => (
            <button
              key={level}
              onClick={() => handleLevelChange(level)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                levelFilter === level
                  ? 'bg-oxblood text-beige'
                  : 'bg-beige text-oxblood hover:bg-oxblood/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Log Entries */}
      <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
        <div className="p-3 bg-gray-800 border-b border-gray-700">
          <pre className="text-xs text-gray-400 font-mono">
            {isLoading ? 'Loading...' : `${logs.length} log entries`}
          </pre>
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 font-mono">
              No logs to display
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {logs.map((log) => {
                const style = getLevelStyle(log.level || '');
                const Icon = style.icon;
                const isExpanded = expandedLogs.has(log.id);
                const hasStack = log.stack || (log.message && log.message.length > 100);

                return (
                  <div
                    key={log.id}
                    className="font-mono text-sm hover:bg-gray-800/50 transition-colors"
                  >
                    <div
                      className="p-3 flex items-start gap-3 cursor-pointer"
                      onClick={() => hasStack && toggleExpand(log.id)}
                    >
                      {/* Timestamp */}
                      <span className="text-gray-500 shrink-0">
                        {formatTimestamp(log.timestamp)}
                      </span>

                      {/* Level Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium shrink-0 ${style.bg} ${style.text}`}
                      >
                        <Icon className="w-3 h-3" />
                        {log.level?.toUpperCase() || 'INFO'}
                      </span>

                      {/* Module */}
                      {log.module && (
                        <span className="text-purple-400 shrink-0">
                          [{log.module}]
                        </span>
                      )}

                      {/* Message */}
                      <span className="text-gray-300 flex-1 break-all">
                        {isExpanded && log.stack ? log.stack : log.message}
                      </span>

                      {/* Expand indicator */}
                      {hasStack && (
                        <span className="text-gray-500 text-xs shrink-0">
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      )}
                    </div>

                    {/* Expanded stack trace */}
                    {isExpanded && log.stack && (
                      <div className="px-3 pb-3 pl-16">
                        <pre className="text-red-400 text-xs whitespace-pre-wrap break-all bg-gray-900/50 p-2 rounded border border-gray-700">
                          {log.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
