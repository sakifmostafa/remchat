import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Database,
  CheckSquare,
  Wrench,
  TrendingUp,
  ArrowRight,
  Activity as ActivityIcon,
  RefreshCw,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { fetchStats, fetchActivity, type Stats } from '@/lib/admin-api';

const formatTimestamp = (ts: string): string => {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getActivityIcon = (type: string) => {
  if (type.includes('task')) return CheckSquare;
  if (type.includes('memory')) return Database;
  if (type.includes('tool')) return Wrench;
  return ActivityIcon;
};

const getActivityColor = (type: string): string => {
  if (type.includes('task')) return 'bg-semantic-success/10 text-semantic-success';
  if (type.includes('memory')) return 'bg-oxblood-primary/10 text-oxblood-primary';
  if (type.includes('tool')) return 'bg-semantic-warning/10 text-semantic-warning';
  if (type.includes('error')) return 'bg-red-100 text-red-700';
  return 'bg-semantic-info/10 text-semantic-info';
};

const StatCardSkeleton: React.FC = () => (
  <div className="bg-cream rounded-2xl p-6 shadow-soft border border-beige-dark/50 animate-pulse">
    <div className="flex items-start justify-between">
      <div className="p-3 rounded-xl bg-beige-dark">
        <div className="w-6 h-6 bg-beige-dark rounded" />
      </div>
    </div>
    <div className="mt-4">
      <div className="h-4 w-20 bg-beige-dark rounded" />
      <div className="h-8 w-16 mt-2 bg-beige-dark rounded" />
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 30000,
  });

  const { data: activityData } = useQuery({
    queryKey: ['dashboardActivity'],
    queryFn: () => fetchActivity(1),
    refetchInterval: 15000,
  });

  const statCards = [
    {
      title: 'Uptime',
      value: data?.uptime ?? '--:--:--',
      icon: Clock,
      subtitle: 'System running time',
      trend: { value: 100, isPositive: true },
    },
    {
      title: 'Memories',
      value: data?.memoryCount ?? 0,
      icon: Database,
      subtitle: 'Stored entries',
      trend: { value: 12, isPositive: true },
    },
    {
      title: 'Tasks',
      value: data?.taskCount ?? 0,
      icon: CheckSquare,
      subtitle: 'Active tasks',
      trend: { value: 3, isPositive: true },
    },
    {
      title: 'Tools',
      value: data?.toolCount ?? 0,
      icon: Wrench,
      subtitle: 'Available tools',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Dashboard"
        description="Overview of your Rem system performance and activity"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : error ? (
          <div className="col-span-full bg-semantic-error/10 border border-semantic-error/20 rounded-2xl p-6 text-center">
            <p className="text-semantic-error font-medium">
              Failed to load statistics.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-4 py-2 bg-oxblood-primary text-cream rounded-lg hover:bg-oxblood-dark transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        ) : (
          statCards.map((stat) => (
            <StatCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              subtitle={stat.subtitle}
              trend={stat.trend}
            />
          ))
        )}
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Status */}
        <div className="bg-cream rounded-2xl p-6 shadow-soft border border-beige-dark/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">System Status</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-semantic-success animate-pulse" />
              <span className="text-sm text-semantic-success font-medium">Online</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary text-sm">CPU Usage</span>
              <span className="text-text-primary font-medium text-sm">23%</span>
            </div>
            <div className="w-full bg-beige-dark rounded-full h-2">
              <div className="bg-oxblood-primary h-2 rounded-full" style={{ width: '23%' }} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary text-sm">Memory</span>
              <span className="text-text-primary font-medium text-sm">67%</span>
            </div>
            <div className="w-full bg-beige-dark rounded-full h-2">
              <div className="bg-semantic-warning h-2 rounded-full" style={{ width: '67%' }} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary text-sm">Disk</span>
              <span className="text-text-primary font-medium text-sm">45%</span>
            </div>
            <div className="w-full bg-beige-dark rounded-full h-2">
              <div className="bg-semantic-success h-2 rounded-full" style={{ width: '45%' }} />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-cream rounded-2xl p-6 shadow-soft border border-beige-dark/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">Recent Activity</h3>
            <button
              onClick={() => navigate('/admin/activity')}
              className="flex items-center gap-1 text-sm text-oxblood-primary hover:text-oxblood-dark transition-colors"
            >
              <span>View all</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            {(activityData?.items || []).slice(0, 5).map((activity) => {
              const Icon = getActivityIcon(activity.type);
              const message =
                typeof activity.details?.message === 'string'
                  ? activity.details.message
                  : typeof activity.details?.description === 'string'
                    ? activity.details.description
                    : `Event: ${activity.type}`;
              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-beige-light transition-colors"
                >
                  <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-sm truncate">{message}</p>
                    <p className="text-text-muted text-xs">{formatTimestamp(activity.timestamp)}</p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-text-muted flex-shrink-0" />
                </div>
              );
            })}
            {(!activityData?.items || activityData.items.length === 0) && (
              <p className="text-text-muted text-sm text-center py-4">No recent activity</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <button
          onClick={() => navigate('/admin/memories')}
          className="bg-cream rounded-2xl p-6 shadow-soft border border-beige-dark/50 hover:shadow-medium transition-all duration-200 text-left group"
        >
          <div className="p-3 rounded-xl bg-oxblood-primary/10 w-fit">
            <Database className="w-6 h-6 text-oxblood-primary" />
          </div>
          <h4 className="mt-4 font-semibold text-text-primary group-hover:text-oxblood-primary transition-colors">
            Manage Memories
          </h4>
          <p className="mt-1 text-text-muted text-sm">
            View and organize your stored knowledge base
          </p>
        </button>
        <button
          onClick={() => navigate('/admin/tasks')}
          className="bg-cream rounded-2xl p-6 shadow-soft border border-beige-dark/50 hover:shadow-medium transition-all duration-200 text-left group"
        >
          <div className="p-3 rounded-xl bg-semantic-success/10 w-fit">
            <CheckSquare className="w-6 h-6 text-semantic-success" />
          </div>
          <h4 className="mt-4 font-semibold text-text-primary group-hover:text-semantic-success transition-colors">
            View Tasks
          </h4>
          <p className="mt-1 text-text-muted text-sm">
            Monitor and manage scheduled RemTasks
          </p>
        </button>
        <button
          onClick={() => navigate('/admin/skills')}
          className="bg-cream rounded-2xl p-6 shadow-soft border border-beige-dark/50 hover:shadow-medium transition-all duration-200 text-left group"
        >
          <div className="p-3 rounded-xl bg-semantic-info/10 w-fit">
            <Wrench className="w-6 h-6 text-semantic-info" />
          </div>
          <h4 className="mt-4 font-semibold text-text-primary group-hover:text-semantic-info transition-colors">
            Browse Skills
          </h4>
          <p className="mt-1 text-text-muted text-sm">
            Explore available tools and capabilities
          </p>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
