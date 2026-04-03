import { useState, useEffect } from 'react';
import { Search, Trash2, X } from 'lucide-react';

interface Memory {
  id: string;
  content: string;
  category: string;
  timestamp: string;
  tags?: string[];
}

interface MemoriesProps {
  api: {
    fetchMemories: (search?: string, category?: string) => Promise<Memory[]>;
    deleteMemory: (id: string) => Promise<{ success: boolean }>;
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  personal: 'bg-purple-100 text-purple-800',
  work: 'bg-blue-100 text-blue-800',
  project: 'bg-green-100 text-green-800',
  idea: 'bg-yellow-100 text-yellow-800',
  task: 'bg-red-100 text-red-800',
  note: 'bg-gray-100 text-gray-800',
  default: 'bg-beige text-oxblood',
};

export default function Memories({ api }: MemoriesProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch memories
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await api.fetchMemories(
          debouncedSearch || undefined,
          category || undefined
        );
        setMemories(data);

        // Extract unique categories
        const uniqueCategories = Array.from(
          new Set(data.map((m) => m.category).filter(Boolean))
        ).sort();
        setCategories(uniqueCategories);
      } catch (error) {
        console.error('Failed to fetch memories:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [debouncedSearch, category]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this memory?')) {
      return;
    }

    setDeletingId(id);
    try {
      const result = await api.deleteMemory(id);
      if (result.success) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete memory:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategory('');
  };

  const getCategoryColor = (cat: string) => {
    return CATEGORY_COLORS[cat.toLowerCase()] || CATEGORY_COLORS.default;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasActiveFilters = searchQuery || category;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-oxblood">Memories</h1>
        <div className="text-sm text-gray-500">
          {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-cream rounded-xl p-4 border border-oxblood/20">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-oxblood focus:border-oxblood"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="sm:w-48">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-oxblood focus:border-oxblood bg-white"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-oxblood hover:bg-oxblood/10 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Memory Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-oxblood border-t-transparent rounded-full animate-spin" />
        </div>
      ) : memories.length === 0 ? (
        <div className="bg-cream rounded-xl p-12 text-center border border-oxblood/20">
          <p className="text-gray-500">
            {hasActiveFilters ? 'No memories match your filters' : 'No memories found'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {memories.map((memory) => (
            <div
              key={memory.id}
              className="bg-cream rounded-xl p-4 border border-oxblood/20 hover:border-oxblood/40 transition-colors relative group"
            >
              {/* Category Badge */}
              {memory.category && (
                <span
                  className={`inline-block px-2 py-1 text-xs font-medium rounded-full mb-2 ${getCategoryColor(
                    memory.category
                  )}`}
                >
                  {memory.category}
                </span>
              )}

              {/* Content */}
              <p className="text-gray-700 whitespace-pre-wrap line-clamp-4">
                {memory.content}
              </p>

              {/* Tags */}
              {memory.tags && memory.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {memory.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 text-xs bg-beige text-oxblood/70 rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Timestamp */}
              <div className="mt-3 text-xs text-gray-400">
                {formatTimestamp(memory.timestamp)}
              </div>

              {/* Delete Button */}
              <button
                onClick={() => handleDelete(memory.id)}
                disabled={deletingId === memory.id}
                className="absolute top-3 right-3 p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Loading overlay */}
              {deletingId === memory.id && (
                <div className="absolute inset-0 bg-white/50 rounded-xl flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-oxblood border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
