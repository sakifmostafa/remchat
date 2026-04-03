import React, { useState } from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Brain,
  Wand2,
  Clock,
  CheckSquare,
  Database,
  BookOpen,
  Activity,
  Settings,
  FileText,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { clearAdminKey } from '@/lib/admin-api';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
  { label: 'Chat', icon: MessageSquare, href: '/admin/chat' },
  { label: 'Agents', icon: Users, href: '/admin/agents' },
  { label: 'Identity', icon: Brain, href: '/admin/identity' },
  { label: 'Skills', icon: Wand2, href: '/admin/skills' },
  { label: 'Cron', icon: Clock, href: '/admin/cron' },
  { label: 'RemTasks', icon: CheckSquare, href: '/admin/tasks' },
  { label: 'Memories', icon: Database, href: '/admin/memories' },
  { label: 'Journal', icon: BookOpen, href: '/admin/journal' },
  { label: 'Activity', icon: Activity, href: '/admin/activity' },
  { label: 'Settings', icon: Settings, href: '/admin/settings' },
  { label: 'Logs', icon: FileText, href: '/admin/logs' },
];

interface SidebarProps {
  currentPath?: string;
  onNavigate?: (href: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const RemAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg'; showName?: boolean }> = ({
  size = 'md',
  showName = true,
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
  };

  return (
    <div className="flex items-center gap-3">
      {imageError ? (
        <div
          className={`${sizeClasses[size]} rounded-full bg-oxblood-primary flex items-center justify-center text-cream font-semibold`}
        >
          R
        </div>
      ) : (
        <img
          src="/rem-avatar.png"
          alt="Rem Avatar"
          className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-oxblood-light/20`}
          onError={() => setImageError(true)}
        />
      )}
      {showName && (
        <div className="flex flex-col">
          <span className="text-text-primary font-semibold text-sm">Rem Admin</span>
          <span className="text-text-muted text-xs">System Control</span>
        </div>
      )}
    </div>
  );
};

const NavItem: React.FC<{
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  collapsed: boolean;
}> = ({ item, isActive, onClick, collapsed }) => {
  const Icon = item.icon;

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200
        ${
          isActive
            ? 'bg-oxblood-primary/10 text-oxblood-primary border-r-2 border-oxblood-primary font-medium'
            : 'text-text-secondary hover:bg-beige-dark hover:text-text-primary'
        }
        ${collapsed ? 'justify-center px-2' : ''}
      `}
      title={collapsed ? item.label : undefined}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-oxblood-primary' : ''}`} />
      {!collapsed && <span className="text-sm">{item.label}</span>}
    </button>
  );
};

const LogoutButton: React.FC<{ collapsed: boolean; onLogout: () => void }> = ({ collapsed, onLogout }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onLogout}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200
        ${isHovered ? 'bg-red-50 text-semantic-error' : 'text-text-muted hover:bg-beige-dark hover:text-text-secondary'}
        ${collapsed ? 'justify-center px-2' : ''}
      `}
      title={collapsed ? 'Logout' : undefined}
    >
      <LogOut className={`w-5 h-5 flex-shrink-0 ${isHovered ? 'text-semantic-error' : ''}`} />
      {!collapsed && (
        <span className="text-sm">Logout</span>
      )}
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath = '/admin',
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}) => {
  const handleNavClick = (href: string) => {
    if (onNavigate) {
      onNavigate(href);
    }
  };

  const handleLogout = () => {
    clearAdminKey();
    window.location.reload();
  };

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen bg-cream border-r border-beige-dark
        transition-all duration-300 ease-in-out flex flex-col
        ${collapsed ? 'w-20' : 'w-64'}
      `}
    >
      {/* Header */}
      <div className="p-4 border-b border-beige-dark">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <RemAvatar size={collapsed ? 'sm' : 'md'} showName={!collapsed} />
          {!collapsed && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg hover:bg-beige-dark transition-colors text-text-muted hover:text-text-primary"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={currentPath === item.href}
            onClick={() => handleNavClick(item.href)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-beige-dark">
        <LogoutButton collapsed={collapsed} onLogout={handleLogout} />
        
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            className="w-full mt-2 p-2 rounded-lg hover:bg-beige-dark transition-colors text-text-muted hover:text-text-primary flex items-center justify-center"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Decorative element */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-oxblood-primary/5 to-transparent pointer-events-none" />
    </aside>
  );
};

export default Sidebar;
