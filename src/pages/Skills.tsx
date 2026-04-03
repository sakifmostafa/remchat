import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSkills, loadSkill } from '@/lib/admin-api';
import PageHeader from '@/components/PageHeader';
import {
  Search,
  Sparkles,
  X,
  FileText,
  Loader2,
  ChevronRight,
} from 'lucide-react';

interface Skill {
  name: string;
  description?: string;
}

interface LoadedSkill {
  name: string;
  description: string;
  content: string;
}

export default function Skills() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<LoadedSkill | null>(null);
  const [isLoadingSkill, setIsLoadingSkill] = useState(false);

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: fetchSkills,
  });

const filteredSkills = skills.filter(
    (skill) =>
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (skill.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSkillClick = async (skill: Skill) => {
    setIsLoadingSkill(true);
    try {
      const content = await loadSkill(skill.name);
      setSelectedSkill({
        name: skill.name,
        description: skill.description || 'No description available',
        content,
      });
    } catch (error) {
      console.error('Failed to load skill:', error);
    } finally {
      setIsLoadingSkill(false);
    }
  };

  const getCategoryColor = (skillName: string) => {
    const name = skillName.toLowerCase();
    if (name.includes('code') || name.includes('dev')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (name.includes('research') || name.includes('data')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (name.includes('write') || name.includes('content')) return 'bg-pink-100 text-pink-800 border-pink-200';
    if (name.includes('web') || name.includes('browser')) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-amber-100 text-amber-800 border-amber-200';
  };

  return (
    <div className="min-h-screen bg-beige">
      <PageHeader
        title="Skills Library"
        description="Browse and explore available agent capabilities"
      />

      <div className="p-6">
        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skills..."
              className="w-full pl-12 pr-4 py-3 bg-cream border border-beige rounded-xl focus:ring-2 focus:ring-oxblood/50 focus:border-oxblood outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Skills Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="bg-cream rounded-xl p-6 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-300 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-5 bg-gray-300 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-300 rounded w-full mb-1" />
                    <div className="h-4 bg-gray-300 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="bg-cream rounded-xl p-12 text-center">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No skills found</h3>
            <p className="text-gray-500">
              {searchQuery
                ? `No skills match "${searchQuery}"`
                : 'No skills are currently available'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSkills.map((skill) => (
              <button
                key={skill.name}
                onClick={() => handleSkillClick(skill)}
                className="bg-cream rounded-xl p-6 text-left hover:shadow-lg hover:shadow-oxblood/10 transition-all border border-beige hover:border-oxblood/30 group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-oxblood/10 rounded-lg flex items-center justify-center group-hover:bg-oxblood/20 transition-colors">
                    <Sparkles className="w-6 h-6 text-oxblood" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-oxblood transition-colors">
                      {skill.name}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {skill.description || 'No description available'}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-oxblood group-hover:translate-x-1 transition-all self-center" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Results count */}
        {!isLoading && filteredSkills.length > 0 && (
          <p className="mt-4 text-sm text-gray-500">
            Showing {filteredSkills.length} of {skills.length} skills
          </p>
        )}
      </div>

      {/* Skill Detail Modal */}
      {selectedSkill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-oxblood text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedSkill.name}</h2>
                    <p className="text-white/80 text-sm">{selectedSkill.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSkill(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="mt-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getCategoryColor(selectedSkill.name)}`}>
                  <FileText className="w-3 h-3 mr-1" />
                  SKILL.md
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 bg-white p-4 rounded-lg border border-beige leading-relaxed">
                {selectedSkill.content}
              </pre>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-beige bg-white/50">
              <button
                onClick={() => setSelectedSkill(null)}
                className="w-full py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal */}
      {isLoadingSkill && !selectedSkill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-cream rounded-2xl p-8 flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-oxblood animate-spin mb-4" />
            <p className="text-gray-600">Loading skill...</p>
          </div>
        </div>
      )}
    </div>
  );
}
