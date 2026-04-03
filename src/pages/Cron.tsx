import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCronJobs,
  createCronJob,
  updateCronJob,
  deleteCronJob,
} from '@/lib/admin-api';
import PageHeader from '@/components/PageHeader';
import {
  Plus,
  Pencil,
  Trash2,
  Pause,
  Play,
  X,
  Loader2,
  Calendar,
  Clock,
  Activity,
  AlertCircle,
} from 'lucide-react';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
}

interface CronFormData {
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
}

export default function Cron() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [formData, setFormData] = useState<CronFormData>({
    name: '',
    schedule: '',
    command: '',
    enabled: true,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: cronJobs = [], isLoading } = useQuery({
    queryKey: ['cronJobs'],
    queryFn: fetchCronJobs,
  });

  const createMutation = useMutation({
    mutationFn: createCronJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronJobs'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CronJob> }) =>
      updateCronJob(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronJobs'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCronJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronJobs'] });
      setDeleteConfirm(null);
    },
  });

  const openCreateModal = () => {
    setEditingJob(null);
    setFormData({ name: '', schedule: '', command: '', enabled: true });
    setIsModalOpen(true);
  };

  const openEditModal = (job: CronJob) => {
    setEditingJob(job);
    setFormData({
      name: job.name,
      schedule: job.schedule,
      command: job.command,
      enabled: job.enabled,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingJob(null);
    setFormData({ name: '', schedule: '', command: '', enabled: true });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingJob) {
      updateMutation.mutate({ id: editingJob.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleJob = (job: CronJob) => {
    updateMutation.mutate({ id: job.id, data: { enabled: !job.enabled } });
  };

  const formatDate = (date?: string) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  const formatSchedule = (schedule: string) => {
    const parts = schedule.split(' ');
    if (parts.length === 5) {
      const [minute, hour, dayMonth, month, dayWeek] = parts;
      return `${minute} ${hour} ${dayMonth} ${month} ${dayWeek}`;
    }
    return schedule;
  };

  const getCronDescription = (schedule: string) => {
    const parts = schedule.split(' ');
    if (parts.length === 5) {
      const [minute, hour] = parts;
      if (minute === '*' && hour === '*') return 'Every minute';
      if (minute === '0' && hour === '*') return 'Every hour';
      if (minute === '0' && hour === '0') return 'Daily at midnight';
      if (minute !== '*' && hour !== '*') return `Daily at ${hour}:${minute.padStart(2, '0')}`;
    }
    return schedule;
  };

  return (
    <div className="min-h-screen bg-beige">
      <PageHeader
        title="Scheduled Tasks"
        description="Manage automated cron jobs and scheduled commands"
        action={
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-oxblood text-white rounded-lg hover:bg-oxblood/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Task
          </button>
        }
      />

      <div className="p-6">
        {/* Table */}
        <div className="bg-cream rounded-xl overflow-hidden border border-beige">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-oxblood text-white">
                  <th className="px-6 py-4 text-left text-sm font-semibold">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Schedule</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Last Run</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Next Run</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige">
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4" colSpan={6}>
                        <div className="flex items-center justify-center gap-2 text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading...
                        </div>
                      </td>
                    </tr>
                  ))
                ) : cronJobs.length === 0 ? (
                  <tr>
                    <td className="px-6 py-12 text-center" colSpan={6}>
                      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No scheduled tasks configured</p>
                      <button
                        onClick={openCreateModal}
                        className="mt-4 text-oxblood hover:underline"
                      >
                        Create your first task
                      </button>
                    </td>
                  </tr>
                ) : (
                  cronJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-white/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{job.name}</p>
                          <p className="text-xs text-gray-500 font-mono truncate max-w-xs">
                            {job.command}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 font-mono">
                              {formatSchedule(job.schedule)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {getCronDescription(job.schedule)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                            job.enabled
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <Activity className="w-3 h-3" />
                          {job.enabled ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{formatDate(job.last_run)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">
                          {job.enabled ? formatDate(job.next_run) : '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleJob(job)}
                            className={`p-2 rounded-lg transition-colors ${
                              job.enabled
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={job.enabled ? 'Pause' : 'Resume'}
                          >
                            {job.enabled ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => openEditModal(job)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(job.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-oxblood text-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {editingJob ? 'Edit Task' : 'Create New Task'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-oxblood/50 focus:border-oxblood outline-none"
                  placeholder="Daily cleanup task"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule (cron expression)
                </label>
                <input
                  type="text"
                  required
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-oxblood/50 focus:border-oxblood outline-none font-mono"
                  placeholder="0 * * * *"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Format: minute hour day month weekday
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Command
                </label>
                <textarea
                  required
                  value={formData.command}
                  onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-oxblood/50 focus:border-oxblood outline-none resize-none font-mono text-sm"
                  placeholder="python scripts/cleanup.py"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) =>
                      setFormData({ ...formData, enabled: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-oxblood/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-oxblood"></div>
                </label>
                <span className="text-sm font-medium text-gray-700">Enable immediately</span>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-3 bg-oxblood text-white rounded-lg hover:bg-oxblood/90 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : editingJob ? (
                    'Save Changes'
                  ) : (
                    'Create Task'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Delete Task?
              </h3>
              <p className="text-gray-600 text-center mb-6">
                This action cannot be undone. The scheduled task will be permanently
                removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirm)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
