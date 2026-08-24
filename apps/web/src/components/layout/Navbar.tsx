import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { useI18nStore } from '../../stores/i18n.store';
import { UserRole } from '@ai-interview/contracts';
import { Button } from '../ui/Button';
import {
  Bot,
  LogOut,
  User,
  History,
  PlayCircle,
  Activity,
  FileText,
  Users,
  Globe,
  TestTube,
  CreditCard,
  BookOpen,
  GitBranch,
  Target,
  Award,
  Building,
  Video,
} from 'lucide-react';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { language, setLanguage, t } = useI18nStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'vi' ? 'en' : 'vi');
  };

  const isAdmin = user?.role === UserRole.ADMIN;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Main Navigation */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-lg text-slate-900">
            <div className="bg-emerald-600 text-white p-1.5 rounded-lg">
              <Bot className="h-5 w-5" />
            </div>
            <span>{t.nav.brand}</span>
          </Link>

          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/interviews/new"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  location.pathname === '/interviews/new'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                }`}
              >
                <PlayCircle className="h-4 w-4" />
                <span>{t.nav.newInterview}</span>
              </Link>
              <Link
                to="/skills"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  location.pathname.startsWith('/skills')
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                }`}
              >
                <GitBranch className="h-4 w-4" />
                <span>Skills</span>
              </Link>
              <Link
                to="/readiness"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  location.pathname.startsWith('/readiness')
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                }`}
              >
                <Target className="h-4 w-4" />
                <span>Readiness</span>
              </Link>
              <Link
                to="/flashcards"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  location.pathname.startsWith('/flashcards')
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>Flashcards</span>
              </Link>
              <Link
                to="/history"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  location.pathname === '/history'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                }`}
              >
                <History className="h-4 w-4" />
                <span>{t.nav.history}</span>
              </Link>
              <Link
                to="/billing"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  location.pathname === '/billing'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="h-4 w-4" />
                <span>Billing</span>
              </Link>
              <Link
                to="/mentors"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  location.pathname.startsWith('/mentors') || location.pathname.startsWith('/mentor')
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                }`}
              >
                <Video className="h-4 w-4" />
                <span>Mentors</span>
              </Link>
              <Link
                to="/profile/portfolio-settings"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  location.pathname.startsWith('/profile/portfolio-settings')
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                }`}
              >
                <Award className="h-4 w-4" />
                <span>Portfolio</span>
              </Link>
              <Link
                to="/b2b/dashboard"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  location.pathname.startsWith('/b2b')
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                }`}
              >
                <Building className="h-4 w-4" />
                <span>B2B</span>
              </Link>
              <Link
                to="/profile"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  location.pathname === '/profile'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                }`}
              >
                <User className="h-4 w-4" />
                <span>Profile</span>
              </Link>

              {isAdmin && (
                <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200">
                  <Link
                    to="/admin/users"
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      location.pathname.startsWith('/admin/users') || location.pathname === '/admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'text-purple-700 hover:bg-purple-50'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>{t.nav.users}</span>
                  </Link>
                  <Link
                    to="/admin/ai-runs"
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      location.pathname.startsWith('/admin/ai-runs')
                        ? 'bg-purple-100 text-purple-800'
                        : 'text-purple-700 hover:bg-purple-50'
                    }`}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    <span>{t.nav.aiTelemetry}</span>
                  </Link>
                  <Link
                    to="/admin/prompts"
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      location.pathname.startsWith('/admin/prompts')
                        ? 'bg-purple-100 text-purple-800'
                        : 'text-purple-700 hover:bg-purple-50'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>{t.nav.prompts}</span>
                  </Link>
                  <Link
                    to="/admin/ai-eval"
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      location.pathname.startsWith('/admin/ai-eval')
                        ? 'bg-purple-100 text-purple-800'
                        : 'text-purple-700 hover:bg-purple-50'
                    }`}
                  >
                    <TestTube className="h-3.5 w-3.5" />
                    <span>{t.nav.evalHarness}</span>
                  </Link>
                </div>
              )}
            </nav>
          )}
        </div>

        {/* Right: Language toggle & User profile / Auth buttons */}
        <div className="flex items-center gap-3">
          {/* Bilingual Language Switcher */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            title="Switch Language / Chuyển đổi ngôn ngữ"
          >
            <Globe className="h-3.5 w-3.5 text-slate-500" />
            <span>{language === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}</span>
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                <User className="h-3.5 w-3.5 text-slate-500" />
                <span className="font-medium text-slate-900">
                  {user?.profile?.fullName || user?.email}
                </span>
                {isAdmin && (
                  <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">
                    ADMIN
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} title={t.nav.signOut}>
                <LogOut className="h-4 w-4 text-slate-500 hover:text-rose-600" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  {t.nav.signIn}
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  {t.nav.getStarted}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
