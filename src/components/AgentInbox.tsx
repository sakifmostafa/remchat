import React, { useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';

type AgentOption = {
  id: string;
  name: string;
  emoji: string;
  avatarUrl?: string;
};

type Props = {
  agents: AgentOption[];
  sessionPreviewByKey: Record<string, Array<{ text?: string; timestamp?: number }>>;
  onSelectAgent: (agentId: string) => void;
  buildSessionKey: (agentId: string) => string;
};

function formatRelativeTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return 'Just now';
  }

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()) {
    return 'Yesterday';
  }

  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const AgentInbox: React.FC<Props> = ({
  agents,
  sessionPreviewByKey,
  onSelectAgent,
  buildSessionKey,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderAvatar = (agent: AgentOption) => {
    const size = 'w-11 h-11';

    if (agent.avatarUrl) {
      return (
        <img
          src={agent.avatarUrl}
          alt={agent.name}
          className={`${size} rounded-full object-cover`}
        />
      );
    }

    if (agent.emoji) {
      return (
        <div className={`${size} rounded-full bg-gray-200 flex items-center justify-center text-xl`}>
          {agent.emoji}
        </div>
      );
    }

    const initial = agent.name.charAt(0).toUpperCase();
    return (
      <div className={`${size} rounded-full bg-blue-500 flex items-center justify-center text-white font-medium`}>
        {initial}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center px-4 py-4 border-b border-gray-100">
        <h1 className="text-2xl font-semibold text-gray-900">Messages</h1>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-gray-100 rounded-full px-10 py-2.5 text-[15px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          />
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto">
        {filteredAgents.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-[15px]">No agents found</p>
          </div>
        ) : (
          <ul>
            {filteredAgents.map((agent) => {
              const sessionKey = buildSessionKey(agent.id);
              const preview = sessionPreviewByKey[sessionKey]?.[0];
              const previewText = preview?.text || 'Tap to start chatting';
              const timestamp = preview?.timestamp;

              return (
                <li key={agent.id}>
                  <button
                    onClick={() => onSelectAgent(agent.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors duration-150 border-b border-gray-100"
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {renderAvatar(agent)}
                    </div>

                    {/* Name and Preview */}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-semibold text-[15px] text-gray-900 truncate">
                        {agent.name}
                      </p>
                      <p className="text-[13px] text-gray-500 line-clamp-2 mt-0.5">
                        {previewText}
                      </p>
                    </div>

                    {/* Timestamp and Chevron */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                      {timestamp && (
                        <span className="text-xs text-gray-400">
                          {formatRelativeTime(timestamp)}
                        </span>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-300" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AgentInbox;
