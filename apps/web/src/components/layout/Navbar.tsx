import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { UserRole } from '@ai-interview/contracts';
import { Button } from '../ui/Button';
import { Bot, LogOut, User, History, Shield, PlayCircle } from 'lucide-react';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-lg text-slate-900">
            <div className="bg-emerald-600 text-white p-1.5 rounded-lg">
              <Bot className="h-5 w-5" />
            </div>
            <span>AI Interview Practice</span>
          </Link>

          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/interviews/new"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <PlayCircle className="h-4 w-4" />
                <span>New Interview</span>
              </Link>
              <Link
                to="/history"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <History className="h-4 w-4" />
                <span>History</span>
              </Link>
              {user?.role === UserRole.ADMIN && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <Shield className="h-4 w-4" />
                  <span>Admin</span>
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                <User className="h-3.5 w-3.5 text-slate-500" />
                <span className="font-medium text-slate-900">
                  {user?.profile?.fullName || user?.email}
                </span>
                {user?.role === UserRole.ADMIN && (
                  <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">
                    ADMIN
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} title="Sign out">
                <LogOut className="h-4 w-4 text-slate-500 hover:text-rose-600" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
