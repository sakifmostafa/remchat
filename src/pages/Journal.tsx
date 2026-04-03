import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJournalEntries } from '@/lib/admin-api';
import PageHeader from '@/components/PageHeader';
import {
  BookOpen,
  Sparkles,
  Heart,
  Mail,
  Calendar,
  Tag,
  Filter,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type JournalSection = 'all' | 'daily' | 'curiosity' | 'emotional' | 'letters';

const sectionConfig: Record<
  JournalSection,
  { label: string; icon: ReactNode; color: string }
> = {
  all: {
    label: 'All Entries',
    icon: <BookOpen className="w-4 h-4" />,
    color: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  },
  daily: {
    label: 'Daily Logs',
    icon: <Calendar className="w-4 h-4" />,
    color: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  },
  curiosity: {
    label: 'Curiosity',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
  },
  emotional: {
    label: 'Emotional',
    icon: <Heart className="w-4 h-4" />,
    color: 'bg-pink-100 text-pink-700 hover:bg-pink-200',
  },
  letters: {
    label: 'Letters',
    icon: <Mail className="w-4 h-4" />,
    color: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  },
};

const moodConfig: Record<string, { emoji: string; color: string }> = {
  happy: { emoji: '😊', color: 'bg-yellow-100 text-yellow-800' },
  sad: { emoji: '😢', color: 'bg-blue-100 text-blue-800' },
  excited: { emoji: '🎉', color: 'bg-green-100 text-green-800' },
  thoughtful: { emoji: '🤔', color: 'bg-purple-100 text-purple-800' },
  grateful: { emoji: '🙏', color: 'bg-rose-100 text-rose-800' },
  anxious: { emoji: '😰', color: 'bg-orange-100 text-orange-800' },
  calm: { emoji: '😌', color: 'bg-teal-100 text-teal-800' },
  frustrated: { emoji: '😤', color: 'bg-red-100 text-red-800' },
};

export default function Journal() {
  const [activeSection, setActiveSection] = useState<JournalSection>('all');
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['journalEntries', activeSection],
    queryFn: () =>
      fetchJournalEntries(activeSection === 'all' ? undefined : activeSection),
  });

  const filteredEntries =
    activeSection === 'all'
      ? entries
      : entries.filter((entry) => entry.type.toLowerCase() === activeSection);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedEntries(newExpanded);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEntryTypeBadge = (type: string) => {
    const typeLower = type.toLowerCase();
    const config =
      sectionConfig[typeLower as keyof typeof sectionConfig] || sectionConfig.daily;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.icon}
        {type}
      </span>
    );
  };

  const renderContent = (content: string) => {
    // Simple markdown-like rendering
    const lines = content.split('\n');
    return lines.map((line, index) => {
      if (line.startsWith('# ')) {
        return (
          <h1 key={index} className="text-2xl font-bold text-gray-900 mb-4">
            {line.substring(2)}
          </h1>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h2 key={index} className="text-xl font-semibold text-gray-800 mb-3">
            {line.substring(3)}
          </h2>
        );
      }
      if (line.startsWith('### ')) {
        return (
          <h3 key={index} className="text-lg font-medium text-gray-700 mb-2">
            {line.substring(4)}
          </h3>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <li key={index} className="ml-4 text-gray-700 list-disc mb-1">
            {line.substring(2)}
          </li>
        );
      }
      if (line.trim() === '') {
        return <br key={index} />;
      }
      // Handle bold
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={index} className="text-gray-700 mb-2">
          {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={i} className="font-semibold">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen bg-beige">
      <PageHeader
        title="Journal"
        description="Explore thoughts, learnings, and reflections"
      />

      <div className="p-6">
        {/* Section Filter */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-600">Filter by type</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(sectionConfig) as JournalSection[]).map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === section
                    ? 'bg-oxblood text-white'
                    : sectionConfig[section].color
                }`}
              >
                {sectionConfig[section].icon}
                {sectionConfig[section].label}
              </button>
            ))}
          </div>
        </div>

        {/* Entries */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-cream rounded-xl p-6 animate-pulse">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-8 h-8 bg-gray-300 rounded-full" />
                  <div className="h-4 bg-gray-300 rounded w-1/4" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-full" />
                  <div className="h-4 bg-gray-300 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="bg-cream rounded-xl p-12 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No entries found</h3>
            <p className="text-gray-500">
              {activeSection === 'all'
                ? 'Journal entries will appear here'
                : `No ${activeSection} entries yet`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEntries.map((entry) => {
              const isExpanded = expandedEntries.has(entry.id);
              const moodInfo = entry.mood
                ? moodConfig[entry.mood.toLowerCase()] || {
                    emoji: '📝',
                    color: 'bg-gray-100 text-gray-700',
                  }
                : null;
              const shouldTruncate = entry.content.length > 500 && !isExpanded;

              return (
                <article
                  key={entry.id}
                  className="bg-cream rounded-xl overflow-hidden border border-beige hover:border-oxblood/30 transition-all"
                >
                  {/* Header */}
                  <div className="p-6 pb-4">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        {getEntryTypeBadge(entry.type)}
                        {moodInfo && (
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${moodInfo.color}`}
                          >
                            <span>{moodInfo.emoji}</span>
                            {entry.mood}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatDate(entry.createdAt)}
                      </div>
                    </div>

                    {/* Content */}
                    <div
                      className={`prose prose-sm max-w-none ${
                        shouldTruncate ? 'line-clamp-6' : ''
                      }`}
                    >
                      {renderContent(entry.content)}
                    </div>

                    {/* Tags */}
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {entry.tags.map((tag: string) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-oxblood/10 text-oxblood rounded text-xs"
                          >
                            <Tag className="w-3 h-3" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expand/Collapse */}
                  {entry.content.length > 500 && (
                    <button
                      onClick={() => toggleExpand(entry.id)}
                      className="w-full px-6 py-3 bg-white/50 border-t border-beige flex items-center justify-center gap-2 text-sm font-medium text-oxblood hover:bg-oxblood/10 transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          Read more
                        </>
                      )}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* Entry count */}
        {!isLoading && filteredEntries.length > 0 && (
          <p className="mt-6 text-sm text-gray-500 text-center">
            Showing {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
          </p>
        )}
      </div>
    </div>
  );
}
