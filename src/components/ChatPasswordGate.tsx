import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Lock } from 'lucide-react';

import { loadRuntimeGatewayConfig } from '@/lib/openclaw-gateway';

const STORAGE_KEY = 'rem_admin_chat_authenticated_v1';

type ChatPasswordGateProps = {
  onAuthenticated: () => void;
};

export default function ChatPasswordGate({ onAuthenticated }: ChatPasswordGateProps) {
  const [password, setPassword] = useState('');
  const [expectedPassword, setExpectedPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (window.sessionStorage.getItem(STORAGE_KEY) === '1') {
      onAuthenticated();
      return;
    }

    void loadRuntimeGatewayConfig()
      .then((config) => {
        if (cancelled) {
          return;
        }
        setExpectedPassword(config?.uiPassword?.trim() || 'Remons108');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [onAuthenticated]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    const trimmed = password.trim();
    if (!trimmed) {
      setError('Enter the chat password.');
      setSubmitting(false);
      return;
    }

    if (trimmed !== expectedPassword) {
      setError('Incorrect password.');
      setSubmitting(false);
      return;
    }

    window.sessionStorage.setItem(STORAGE_KEY, '1');
    onAuthenticated();
  };

  return (
    <div className="min-h-screen bg-beige-bg flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-oxblood-primary/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-oxblood-light/5 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="bg-cream rounded-3xl shadow-medium p-8 md:p-10 border border-beige-dark">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full bg-oxblood-primary flex items-center justify-center text-cream font-bold shadow-medium">
              <span className="text-3xl">R</span>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-text-primary tracking-tight">OpenClaw Chat</h1>
            <p className="text-text-muted text-sm">Enter the LAN chat password</p>
          </div>

          {error ? (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-semantic-error flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-semantic-error text-sm font-medium">Authentication Error</p>
                <p className="text-semantic-error/80 text-sm mt-1">{error}</p>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="chat-password" className="block text-sm font-medium text-text-secondary">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-text-muted" />
                </div>
                <input
                  type="password"
                  id="chat-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={loading ? 'Loading password policy...' : 'Enter password'}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-beige-light border border-beige-dark text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-oxblood-primary/20 focus:border-oxblood-primary transition-all duration-200"
                  disabled={loading || submitting}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || submitting}
              className="w-full py-4 px-6 rounded-xl font-semibold text-cream bg-oxblood-primary shadow-soft transition-all duration-200 flex items-center justify-center gap-2 hover:bg-oxblood-dark disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {loading || submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{loading ? 'Loading...' : 'Unlocking...'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>Unlock Chat</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
