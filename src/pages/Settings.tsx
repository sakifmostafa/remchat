import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle, AlertCircle } from 'lucide-react';

interface Setting {
  key: string;
  value: unknown;
  type: 'boolean' | 'number' | 'string';
  description?: string;
}

interface SettingsResponse {
  settings: Record<string, unknown>;
  mutable_fields: string[];
}

interface SettingsProps {
  api: {
    fetchSettings: () => Promise<SettingsResponse>;
    updateSettings: (data: Record<string, unknown>) => Promise<{ success: boolean; message?: string }>;
  };
}

export default function Settings({ api }: SettingsProps) {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [mutableFields, setMutableFields] = useState<string[]>([]);
  const [originalValues, setOriginalValues] = useState<Record<string, unknown>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await api.fetchSettings();
        const mutable = response.mutable_fields || [];

        const settingsArray: Setting[] = Object.entries(response.settings).map(
          ([key, value]) => {
            let type: 'boolean' | 'number' | 'string' = 'string';
            if (typeof value === 'boolean') {
              type = 'boolean';
            } else if (typeof value === 'number') {
              type = 'number';
            }
            return { key, value, type };
          }
        );

        // Sort: mutable first, then alphabetical
        settingsArray.sort((a, b) => {
          const aMutable = mutable.includes(a.key);
          const bMutable = mutable.includes(b.key);
          if (aMutable && !bMutable) return -1;
          if (!aMutable && bMutable) return 1;
          return a.key.localeCompare(b.key);
        });

        setSettings(settingsArray);
        setMutableFields(mutable);
        setOriginalValues(response.settings);
      } catch (error) {
        console.error('Failed to fetch settings:', error);
        setMessage({ type: 'error', text: 'Failed to load settings' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [api]);

  const handleChange = (key: string, value: unknown) => {
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value } : s))
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    const changedSettings: Record<string, unknown> = {};

    settings.forEach((setting) => {
      if (originalValues[setting.key] !== setting.value) {
        changedSettings[setting.key] = setting.value;
      }
    });

    if (Object.keys(changedSettings).length === 0) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const result = await api.updateSettings(changedSettings);
      if (result.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
        setOriginalValues(
          settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
        );
        setHasChanges(false);
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings((prev) =>
      prev.map((s) => ({
        ...s,
        value: originalValues[s.key],
      }))
    );
    setHasChanges(false);
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const renderInput = (setting: Setting) => {
    const isMutable = mutableFields.includes(setting.key);

    switch (setting.type) {
      case 'boolean':
        return (
          <button
            onClick={() => isMutable && handleChange(setting.key, !setting.value)}
            disabled={!isMutable}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              setting.value ? 'bg-oxblood' : 'bg-gray-300'
            } ${!isMutable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                setting.value ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        );

      case 'number':
        return (
          <input
            type="number"
            value={String(setting.value)}
            onChange={(e) =>
              handleChange(setting.key, parseFloat(e.target.value) || 0)
            }
            disabled={!isMutable}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-oxblood focus:border-oxblood ${
              !isMutable
                ? 'bg-gray-100 cursor-not-allowed'
                : 'bg-white'
            }`}
          />
        );

      default:
        return (
          <input
            type="text"
            value={String(setting.value ?? '')}
            onChange={(e) => handleChange(setting.key, e.target.value)}
            disabled={!isMutable}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-oxblood focus:border-oxblood ${
              !isMutable
                ? 'bg-gray-100 cursor-not-allowed'
                : 'bg-white'
            }`}
          />
        );
    }
  };

  const mutableCount = settings.filter((s) => mutableFields.includes(s.key)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-6 h-6 text-oxblood" />
          <h1 className="text-2xl font-bold text-oxblood">Settings</h1>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-sm text-amber-600">Unsaved changes</span>
          )}
          <button
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
            className="px-4 py-2 text-oxblood hover:bg-oxblood/10 disabled:opacity-50 disabled:hover:bg-transparent rounded-lg transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-oxblood hover:bg-oxblood/90 disabled:bg-oxblood/50 text-beige rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-3 rounded-lg flex items-center gap-2 ${
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

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>{mutableCount}</strong> of <strong>{settings.length}</strong> settings can be
          modified. Read-only settings are grayed out.
        </p>
      </div>

      {/* Settings List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-oxblood border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-cream rounded-xl border border-oxblood/20 overflow-hidden">
          {settings.map((setting, index) => (
            <div
              key={setting.key}
              className={`p-4 ${
                index !== settings.length - 1 ? 'border-b border-oxblood/10' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-oxblood">{setting.key}</span>
                    {mutableFields.includes(setting.key) ? (
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                        editable
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                        read-only
                      </span>
                    )}
                  </div>
                  {setting.description && (
                    <p className="text-sm text-gray-500 mt-1">{setting.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Type: {setting.type}
                  </p>
                </div>
                <div className="w-48">{renderInput(setting)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
