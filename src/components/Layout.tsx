import { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Landmark, PiggyBank, Shield, TrendingUp, BookOpen,
  FileText, Search, Settings, LogOut, Menu, X, Lock, Phone, Calculator,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { TimeTravel } from './TimeTravel';
import { ProfileSwitcher } from './ProfileSwitcher';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/bank', label: 'ICICI Bank', icon: Landmark },
  { to: '/post-office', label: 'Post Office', icon: PiggyBank },
  { to: '/insurance', label: 'Insurance', icon: Shield },
  { to: '/investments', label: 'Investments', icon: TrendingUp },
  { to: '/bonds', label: 'Bonds', icon: FileText },
  { to: '/learning', label: 'Learning', icon: BookOpen },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/phone-inbox', label: 'Phone Inbox', icon: Phone },
  { to: '/security', label: 'Security', icon: Lock },
  { to: '/income-tax', label: 'Income Tax', icon: Calculator },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Layout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col">
      <div className="flex flex-1">
        {/* Sidebar - desktop */}
        <aside className="hidden md:flex w-64 flex-col bg-ink-900 text-ink-100 min-h-screen">
          <div className="px-5 py-4 border-b border-ink-800">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
                P
              </div>
              <span className="font-semibold text-white">Paisa Practice</span>
            </Link>
          </div>
          <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-brand-600 text-white font-medium'
                      : 'text-ink-300 hover:bg-ink-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-2 py-3 border-t border-ink-800">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-300 hover:bg-ink-800 hover:text-white transition-colors w-full"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Sidebar - mobile drawer */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <aside className="relative w-64 flex flex-col bg-ink-900 text-ink-100 animate-slide-in-right">
              <div className="px-5 py-4 border-b border-ink-800 flex items-center justify-between">
                <span className="font-semibold text-white">Menu</span>
                <button onClick={() => setSidebarOpen(false)} className="text-ink-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? 'bg-brand-600 text-white font-medium'
                          : 'text-ink-300 hover:bg-ink-800 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="px-2 py-3 border-t border-ink-800">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-300 hover:bg-ink-800 hover:text-white transition-colors w-full"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 bg-white border-b border-ink-200 px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden text-ink-600 hover:text-ink-900"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden md:block">
                <TimeTravel />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <TimeTravel />
              </div>
              <ProfileSwitcher />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
