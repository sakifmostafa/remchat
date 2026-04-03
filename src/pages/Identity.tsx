import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchIdentityFile, saveIdentityFile } from '@/lib/admin-api';
import PageHeader from '@/components/PageHeader';
import { FileText, Save, RefreshCw, Loader2 } from 'lucide-react';

type IdentityFile = 'SOUL.md' | 'MEMORY.md' | 'YOUR_CAPABILITIES.md';

const fileDescriptions: Record<IdentityFile, string> = {
  'SOUL.md': 'Defines the agent\'s personality, values, and emotional character',
  'MEMORY.md': 'Contains persistent memories and learned knowledge',
  'YOUR_CAPABILITIES.md': 'Lists available tools and operational capabilities',
};

export default function Identity() {
  const queryClient = useQueryClient();
  const [activeFile, setActiveFile] = useState<IdentityFile>('SOUL.md');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: soulContent, isLoading: soulLoading } = useQuery({
    queryKey: ['identity', 'SOUL.md'],
    queryFn: () => fetchIdentityFile('SOUL.md'),
    enabled: activeFile === 'SOUL.md',
  });

  const { data: memoryContent, isLoading: memoryLoading } = useQuery({
    queryKey: ['identity', 'MEMORY.md'],
    queryFn: () => fetchIdentityFile('MEMORY.md'),
    enabled: activeFile === 'MEMORY.md',
  });

  const { data: capabilitiesContent, isLoading: capabilitiesLoading } = useQuery({
    queryKey: ['identity', 'YOUR_CAPABILITIES.md'],
    queryFn: () => fetchIdentityFile('YOUR_CAPABILITIES.md'),
    enabled: activeFile === 'YOUR_CAPABILITIES.md',
  });

  const saveMutation = useMutation({
    mutationFn: ({ file, content }: { file: string; content: string }) =>
      saveIdentityFile(file, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
  });

  const handleTabChange = (file: IdentityFile) => {
    setActiveFile(file);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync({ file: activeFile, content });
    } finally {
      setIsSaving(false);
    }
  };

  const getCurrentContent = () => {
    if (soulLoading || memoryLoading || capabilitiesLoading) return '';
    switch (activeFile) {
      case 'SOUL.md':
        return soulContent ?? '';
      case 'MEMORY.md':
        return memoryContent ?? '';
      case 'YOUR_CAPABILITIES.md':
        return capabilitiesContent ?? '';
      default:
        return '';
    }
  };

  const isLoading = () => {
    switch (activeFile) {
      case 'SOUL.md':
        return soulLoading;
      case 'MEMORY.md':
        return memoryLoading;
      case 'YOUR_CAPABILITIES.md':
        return capabilitiesLoading;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-beige">
      <PageHeader
        title="Agent Identity"
        description="Configure your agent's core identity files"
        action={
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['identity'] })}
            className="flex items-center gap-2 px-4 py-2 bg-oxblood text-white rounded-lg hover:bg-oxblood/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      <div className="p-6">
        {/* File Tabs */}
        <div className="bg-oxblood rounded-t-xl">
          <div className="flex">
            {(['SOUL.md', 'MEMORY.md', 'YOUR_CAPABILITIES.md'] as IdentityFile[]).map(
              (file) => (
                <button
                  key={file}
                  onClick={() => handleTabChange(file)}
                  className={`flex-1 px-6 py-4 font-medium transition-all relative ${
                    activeFile === file
                      ? 'bg-cream text-oxblood'
                      : 'bg-oxblood text-white hover:bg-oxblood/80'
                  } ${file === 'YOUR_CAPABILITIES.md' ? 'rounded-tr-xl' : ''}`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>{file}</span>
                  </div>
                  {activeFile === file && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-oxblood" />
                  )}
                </button>
              )
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-cream rounded-b-xl border-x border-b border-beige">
          {/* Description */}
          <div className="p-4 border-b border-beige bg-white/50">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-oxblood">Purpose:</span>{' '}
              {fileDescriptions[activeFile]}
            </p>
          </div>

          {/* Toolbar */}
          <div className="p-4 border-b border-beige flex items-center justify-between bg-white/30">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {content.length.toLocaleString()} characters
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-500">
                {content.split('\n').length} lines
              </span>
            </div>
            <div className="flex items-center gap-3">
              {saveSuccess && (
                <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                  <Save className="w-4 h-4" />
                  Saved successfully
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving || isLoading()}
                className="flex items-center gap-2 px-4 py-2 bg-oxblood text-white rounded-lg hover:bg-oxblood/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="p-4">
            {isLoading() ? (
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6" />
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
              </div>
            ) : (
              <textarea
                value={getCurrentContent()}
                onChange={(e) => {
                  setContent(e.target.value);
                  setSaveSuccess(false);
                }}
                onBlur={() => {
                  if (!content && getCurrentContent()) {
                    setContent(getCurrentContent());
                  }
                }}
                onFocus={() => {
                  if (!content) {
                    setContent(getCurrentContent());
                  }
                }}
                className="w-full h-[calc(100vh-400px)] min-h-[400px] p-4 bg-white border border-gray-300 rounded-lg font-mono text-sm leading-relaxed focus:ring-2 focus:ring-oxblood/50 focus:border-oxblood outline-none resize-none"
                placeholder="Loading file content..."
              />
            )}
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-white rounded-lg border border-beige">
          <h3 className="font-medium text-gray-900 mb-2">Tips for Identity Files</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• SOUL.md defines personality traits, values, and behavioral guidelines</li>
            <li>• MEMORY.md stores persistent context that persists between sessions</li>
            <li>• YOUR_CAPABILITIES.md lists available tools and what the agent can do</li>
            <li>• Use Markdown syntax for formatting (headers, lists, emphasis)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
