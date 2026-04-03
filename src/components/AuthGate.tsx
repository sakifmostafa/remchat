import React, { useState } from 'react';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';
import { getAdminKey, setAdminKey, validateAdminKey } from '@/lib/admin-api';

interface AuthGateProps {
  onAuthenticated: () => void;
}

const RemLogo: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {imageError ? (
        <div
          className={`${sizeClasses[size]} rounded-full bg-oxblood-primary flex items-center justify-center text-cream font-bold shadow-medium`}
        >
          <span className="text-3xl">R</span>
        </div>
      ) : (
        <img
          src="/rem-avatar.png"
          alt="Rem Logo"
          className={`${sizeClasses[size]} rounded-full object-cover shadow-medium ring-4 ring-oxblood-light/20`}
          onError={() => setImageError(true)}
        />
      )}
      <h1 className="text-2xl font-bold text-text-primary tracking-tight">Rem Admin</h1>
      <p className="text-text-muted text-sm">Access your dashboard</p>
    </div>
  );
};

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  React.useEffect(() => {
    if (getAdminKey()) {
      onAuthenticated();
    }
  }, [onAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const trimmedPassword = password.trim();
      if (!trimmedPassword) {
        setError('Please enter your API key');
        return;
      }

      await validateAdminKey(trimmedPassword);
      setAdminKey(trimmedPassword);
      onAuthenticated();
    } catch {
      setError('Invalid API key');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-beige-bg flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-oxblood-primary/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-oxblood-light/5 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md animate-fade-in">
        <div className="bg-cream rounded-3xl shadow-medium p-8 md:p-10 border border-beige-dark">
          {/* Logo Section */}
          <div className="flex flex-col items-center mb-8">
            <RemLogo size="lg" />
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-semantic-error flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-semantic-error text-sm font-medium">Authentication Error</p>
                <p className="text-semantic-error/80 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
                API Key
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-text-muted" />
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your API key"
                  className="
                    w-full pl-12 pr-4 py-3.5 rounded-xl
                    bg-beige-light border border-beige-dark
                    text-text-primary placeholder-text-muted
                    focus:outline-none focus:ring-2 focus:ring-oxblood-primary/20 focus:border-oxblood-primary
                    transition-all duration-200
                  "
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              disabled={isLoading}
              className={`
                w-full py-4 px-6 rounded-xl font-semibold text-cream
                transition-all duration-200 flex items-center justify-center gap-2
                ${isHovered ? 'bg-oxblood-dark shadow-medium scale-[1.02]' : 'bg-oxblood-primary shadow-soft'}
                ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}
                disabled:opacity-75 disabled:cursor-not-allowed
              `}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Footer text */}
          <p className="text-center text-text-muted text-xs mt-6">
            Secure access to Rem Admin Dashboard
          </p>
        </div>

        {/* Decorative border accent */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-oxblood-light/30 to-transparent rounded-full" />
      </div>
    </div>
  );
};

export default AuthGate;
