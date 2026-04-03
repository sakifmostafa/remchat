import React, { useState, useEffect } from 'react';
import { ExternalLink, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { changeRemTasksPassword } from '@/lib/admin-api';

export default function RemTasks() {
  const [iframeKey, setIframeKey] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const iframeUrl = 'http://192.168.2.142:3001/app';

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(iframeUrl, '_blank');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await changeRemTasksPassword(password);
      if (result.success) {
        setMessage({ type: 'success', text: 'Password updated successfully' });
        setPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to update password' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update password' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-oxblood">Reminder Tasks</h1>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-beige hover:bg-cream text-oxblood rounded-lg transition-colors"
          >
            <Eye className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleOpenExternal}
            className="flex items-center gap-2 px-4 py-2 bg-oxblood hover:bg-oxblood/90 text-beige rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open External
          </button>
        </div>
      </div>

      {/* Iframe */}
      <div className="bg-beige rounded-xl overflow-hidden border border-oxblood/20">
        <div className="bg-oxblood/10 px-4 py-2 border-b border-oxblood/20">
          <span className="text-sm font-medium text-oxblood">RemTasks Application</span>
        </div>
        <iframe
          key={iframeKey}
          src={iframeUrl}
          className="w-full h-[600px] border-0"
          title="Reminder Tasks"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>

      {/* Password Change Form */}
      <div className="bg-cream rounded-xl p-6 border border-oxblood/20">
        <h2 className="text-lg font-semibold text-oxblood mb-4">Change RemTasks Password</h2>

        {message && (
          <div
            className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-oxblood focus:border-oxblood"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-oxblood focus:border-oxblood"
              placeholder="Confirm new password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-oxblood hover:bg-oxblood/90 disabled:bg-oxblood/50 text-beige rounded-lg font-medium transition-colors"
          >
            {isLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
