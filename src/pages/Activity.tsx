import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Clock, Activity as ActivityIcon } from 'lucide-react';

interface Activity {
  id: string;
  type: string;
  timestamp: string;
  details: Record<string, unknown>;
  user?: string;
}

interface ActivityResponse {
  items: Activity[];
  total: number;
  page: number;
}

interface ActivityProps {
  api: {
    fetchActivity: (page?: number, type?: string) => Promise<ActivityResponse>;
  };
}

const EVENT_TYPES = [
  'all',
  'agent_start',
  'agent_stop',
  'task_complete',
  'task_fail',
  'tool_execute',
  'cron_run',
  'error',
  'login',
  'logout',
];

const TYPE_BADGES: Record<string, { bg: string; text: string; icon?: string }> = {
  agent_start: { bg: 'bg-green-100', text: 'text-green-800' },
  agent_stop: { bg: 'bg-gray-100', text: 'text-gray-800' },
  task_complete: { bg: 'bg-blue-100', text: 'text-blue-800' },
  task_fail: { bg: 'bg-red-100', text: 'text-red-800' },
  tool_execute: { bg: 'bg-purple-100', text: 'text-purple-800' },
  cron_run: { bg: 'bg-amber-100', text: 'text-amber-800' },
  error: { bg: 'bg-red-100', text: 'text-red-800' },
  login: { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  logout: { bg: 'bg-slate-100', text: 'text-slate-800' },
  default: { bg: 'bg-beige', text: 'text-oxblood' },
};

export default function Activity({ api }: ActivityProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.fetchActivity(
        page,
        typeFilter === 'all' ? undefined : typeFilter
      );
      setActivities(response.items);
      setTotal(response.total);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setIsLoading(false);
    }
  }, [api, page, typeFilter]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchActivities();

    const interval = setInterval(() => {
      fetchActivities();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchActivities]);

  const handleRefresh = () => {
    fetchActivities();
  };

  const handleTypeChange = (type: string) => {
    setTypeFilter(type);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const getTypeBadge = (type: string) => {
    const badge = TYPE_BADGES[type] || TYPE_BADGES.default;
    return `${badge.bg} ${badge.text}`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const formatFullTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActivityMessage = (activity: Activity) => {
    const message = activity.details?.message;
    const description = activity.details?.description;

    if (typeof message === 'string') return message;
    if (typeof description === 'string') return description;
    return `Event: ${activity.type}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ActivityIcon className="w-6 h-6 text-oxblood" />
          <h1 className="text-2xl font-bold text-oxblood">Activity Log</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
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

      {/* Type Filter */}
      <div className="bg-cream rounded-xl p-4 border border-oxblood/20">
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                typeFilter === type
                  ? 'bg-oxblood text-beige'
                  : 'bg-beige text-oxblood hover:bg-oxblood/20'
              }`}
            >
              {type === 'all' ? 'All Events' : type.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-3">
        {isLoading && activities.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-oxblood border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <div className="bg-cream rounded-xl p-12 text-center border border-oxblood/20">
            <p className="text-gray-500">No activity found</p>
          </div>
        ) : (
          <>
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="bg-cream rounded-xl p-4 border border-oxblood/20 hover:border-oxblood/40 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getTypeBadge(
                        activity.type
                      )}`}
                    >
                      {activity.type.replace(/_/g, ' ')}
                    </span>
                    <div>
                      <p className="text-sm text-gray-700">
                        {getActivityMessage(activity)}
                      </p>
                      {activity.user && (
                        <p className="text-xs text-gray-500 mt-1">User: {activity.user}</p>
                      )}
                      <p
                        className="text-xs text-gray-400 mt-1 cursor-help"
                        title={formatFullTimestamp(activity.timestamp)}
                      >
                        {formatTimestamp(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional Details */}
                {Object.keys(activity.details || {}).filter(
                  (k) => !['message', 'description'].includes(k)
                ).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <pre className="text-xs text-gray-500 overflow-x-auto">
                      {JSON.stringify(
                        Object.fromEntries(
                          Object.entries(activity.details || {}).filter(
                            ([k]) => !['message', 'description'].includes(k)
                          )
                        ),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-cream rounded-xl p-4 border border-oxblood/20">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}{' '}
            activities
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="p-2 rounded-lg hover:bg-beige disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-oxblood text-beige'
                        : 'hover:bg-beige text-oxblood'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              className="p-2 rounded-lg hover:bg-beige disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
