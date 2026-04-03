import { useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import adminApi from '@/lib/admin-api';
import AuthGate from '@/components/AuthGate';
import ChatPasswordGate from '@/components/ChatPasswordGate';
import Sidebar from '@/components/Sidebar';

import Dashboard from '@/pages/Dashboard';
import Chat from '@/pages/Chat';
import Agents from '@/pages/Agents';
import Identity from '@/pages/Identity';
import Skills from '@/pages/Skills';
import Cron from '@/pages/Cron';
import RemTasks from '@/pages/RemTasks';
import Memories from '@/pages/Memories';
import Journal from '@/pages/Journal';
import ActivityPage from '@/pages/Activity';
import SettingsPage from '@/pages/Settings';
import Logs from '@/pages/Logs';

function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-beige-bg">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        currentPath={location.pathname}
        onNavigate={navigate}
      />
      <main className={`min-h-screen p-6 transition-all duration-300 ${collapsed ? 'ml-20' : 'ml-64'}`}>
        <Routes>
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/chat" element={<Chat />} />
          <Route path="/admin/agents" element={<Agents />} />
          <Route path="/admin/identity" element={<Identity />} />
          <Route path="/admin/skills" element={<Skills />} />
          <Route path="/admin/cron" element={<Cron />} />
          <Route path="/admin/tasks" element={<RemTasks />} />
          <Route path="/admin/memories" element={<Memories api={adminApi} />} />
          <Route path="/admin/journal" element={<Journal />} />
          <Route path="/admin/activity" element={<ActivityPage api={adminApi} />} />
          <Route path="/admin/settings" element={<SettingsPage api={adminApi} />} />
          <Route path="/admin/logs" element={<Logs api={adminApi} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [chatAuthenticated, setChatAuthenticated] = useState(false);
  const location = useLocation();

  if (location.pathname === '/chat' || location.pathname === '/chat/') {
    return chatAuthenticated ? (
      <Chat standalone />
    ) : (
      <ChatPasswordGate onAuthenticated={() => setChatAuthenticated(true)} />
    );
  }

  return authenticated ? <Layout /> : <AuthGate onAuthenticated={() => setAuthenticated(true)} />;
}
