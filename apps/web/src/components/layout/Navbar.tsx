import { useState, useEffect, useRef } from 'react';
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
  Menu,
  X,
  ChevronDown,
  Sparkles,
  Shield,
  Layers,
} from 'lucide-react';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { language, setLanguage, t } = useI18nStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [growthOpen, setGrowthOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const practiceRef = useRef<HTMLDivElement>(null);
  const growthRef = useRef<HTMLDivElement>(null);
  const adminRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setPracticeOpen(false);
    setGrowthOpen(false);
    setAdminOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (practiceRef.current && !practiceRef.current.contains(event.target as Node)) {
        setPracticeOpen(false);
      }
      if (growthRef.current && !growthRef.current.contains(event.target as Node)) {
        setGrowthOpen(false);
      }
      if (adminRef.current && !adminRef.current.contains(event.target as Node)) {
        setAdminOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'vi' ? 'en' : 'vi');
  };

  const isAdmin = user?.role === UserRole.ADMIN;

  const isPracticeActive =
    location.pathname === '/interviews/new' ||
    location.pathname.startsWith('/flashcards') ||
    location.pathname === '/history';

  const isGrowthActive =
    location.pathname.startsWith('/skills') ||
    location.pathname.startsWith('/readiness') ||
    location.pathname.startsWith('/profile/portfolio-settings');

  const isAdminActive = location.pathname.startsWith('/admin');

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Desktop Navigation */}
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-extrabold text-lg text-slate-900 hover:opacity-90 transition-opacity"
          >
            <div className="bg-emerald-600 text-white p-1.5 rounded-xl shadow-xs">
              <Bot className="h-5 w-5" />
            </div>
            <span className="tracking-tight">{t.nav.brand}</span>
          </Link>

          {isAuthenticated && (
            <nav className="hidden lg:flex items-center gap-1">
              {/* Direct Link: New Interview */}
              <Link
                to="/interviews/new"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  location.pathname === '/interviews/new'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                }`}
              >
                <PlayCircle className="h-4 w-4 text-emerald-600" />
                <span>{t.nav.newInterview}</span>
              </Link>

              {/* Dropdown: Practice */}
              <div className="relative" ref={practiceRef}>
                <button
                  type="button"
                  onClick={() => {
                    setPracticeOpen(!practiceOpen);
                    setGrowthOpen(false);
                    setAdminOpen(false);
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    isPracticeActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>{t.nav.practiceMenu}</span>
                  <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                </button>

                {practiceOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-slide-up">
                    <Link
                      to="/interviews/new"
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-600"
                    >
                      <PlayCircle className="h-4 w-4 text-emerald-600" />
                      <span>{t.nav.newInterview}</span>
                    </Link>
                    <Link
                      to="/flashcards"
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-600"
                    >
                      <BookOpen className="h-4 w-4 text-indigo-600" />
                      <span>{t.nav.flashcards}</span>
                    </Link>
                    <Link
                      to="/history"
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-600"
                    >
                      <History className="h-4 w-4 text-slate-600" />
                      <span>{t.nav.history}</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Dropdown: Growth & Skills */}
              <div className="relative" ref={growthRef}>
                <button
                  type="button"
                  onClick={() => {
                    setGrowthOpen(!growthOpen);
                    setPracticeOpen(false);
                    setAdminOpen(false);
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    isGrowthActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{t.nav.growthMenu}</span>
                  <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                </button>

                {growthOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-slide-up">
                    <Link
                      to="/skills"
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-600"
                    >
                      <GitBranch className="h-4 w-4 text-emerald-600" />
                      <span>{t.nav.skills}</span>
                    </Link>
                    <Link
                      to="/readiness"
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-600"
                    >
                      <Target className="h-4 w-4 text-amber-600" />
                      <span>{t.nav.readiness}</span>
                    </Link>
                    <Link
                      to="/profile/portfolio-settings"
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-600"
                    >
                      <Award className="h-4 w-4 text-purple-600" />
                      <span>{t.nav.portfolio}</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Direct: Mentors */}
              <Link
                to="/mentors"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  location.pathname.startsWith('/mentors') || location.pathname.startsWith('/mentor')
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                }`}
              >
                <Video className="h-3.5 w-3.5 text-slate-600" />
                <span>{t.nav.mentors}</span>
              </Link>

              {/* Direct: B2B */}
              <Link
                to="/b2b/dashboard"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  location.pathname.startsWith('/b2b')
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                }`}
              >
                <Building className="h-3.5 w-3.5 text-slate-600" />
                <span>{t.nav.b2b}</span>
              </Link>

              {/* Direct: Pricing */}
              <Link
                to="/pricing"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  location.pathname === '/pricing'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="h-3.5 w-3.5 text-slate-600" />
                <span>{t.nav.pricing}</span>
              </Link>

              {/* Admin Dropdown */}
              {isAdmin && (
                <div className="relative ml-1 pl-1 border-l border-slate-200" ref={adminRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminOpen(!adminOpen);
                      setPracticeOpen(false);
                      setGrowthOpen(false);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      isAdminActive
                        ? 'bg-purple-100 text-purple-800'
                        : 'text-purple-700 hover:bg-purple-50'
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    <span>{t.nav.admin}</span>
                    <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                  </button>

                  {adminOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-purple-100 py-1.5 z-50 animate-slide-up">
                      <Link
                        to="/admin/users"
                        className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-800"
                      >
                        <Users className="h-3.5 w-3.5 text-purple-600" />
                        <span>{t.nav.users}</span>
                      </Link>
                      <Link
                        to="/admin/ai-runs"
                        className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-800"
                      >
                        <Activity className="h-3.5 w-3.5 text-purple-600" />
                        <span>{t.nav.aiTelemetry}</span>
                      </Link>
                      <Link
                        to="/admin/prompts"
                        className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-800"
                      >
                        <FileText className="h-3.5 w-3.5 text-purple-600" />
                        <span>{t.nav.prompts}</span>
                      </Link>
                      <Link
                        to="/admin/ai-eval"
                        className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-800"
                      >
                        <TestTube className="h-3.5 w-3.5 text-purple-600" />
                        <span>{t.nav.evalHarness}</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </nav>
          )}
        </div>

        {/* Right: Language toggle & User profile / Auth buttons */}
        <div className="flex items-center gap-2.5">
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
            <div className="flex items-center gap-2">
              {/* User Profile Dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-full transition-colors"
                >
                  <div className="h-5 w-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                    {(user?.profile?.fullName || user?.email || 'U')[0].toUpperCase()}
                  </div>
                  <span className="font-semibold text-slate-900 hidden sm:inline max-w-[120px] truncate">
                    {user?.profile?.fullName || user?.email?.split('@')[0]}
                  </span>
                  {isAdmin && (
                    <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded hidden sm:inline">
                      ADMIN
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-slide-up">
                    <div className="px-3.5 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {user?.profile?.fullName || 'User'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    </div>

                    <Link
                      to="/profile"
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-600"
                    >
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span>{t.nav.profile}</span>
                    </Link>
                    <Link
                      to="/billing"
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-600"
                    >
                      <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                      <span>{t.nav.billing}</span>
                    </Link>

                    <div className="border-t border-slate-100 my-1"></div>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>{t.nav.signOut}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Hamburger Toggle */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Open mobile navigation"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
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

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && isAuthenticated && (
        <div className="lg:hidden fixed inset-0 top-16 z-50 bg-slate-900/50 backdrop-blur-xs flex flex-col justify-between">
          <div className="bg-white border-b border-slate-200 p-4 space-y-4 max-h-[80vh] overflow-y-auto shadow-2xl">
            {/* Practice Section */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3">
                {t.nav.practiceMenu}
              </span>
              <div className="mt-1 space-y-1">
                <Link
                  to="/interviews/new"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <PlayCircle className="h-4 w-4 text-emerald-600" />
                  <span>{t.nav.newInterview}</span>
                </Link>
                <Link
                  to="/flashcards"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  <span>{t.nav.flashcards}</span>
                </Link>
                <Link
                  to="/history"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <History className="h-4 w-4 text-slate-600" />
                  <span>{t.nav.history}</span>
                </Link>
              </div>
            </div>

            {/* Growth Section */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3">
                {t.nav.growthMenu}
              </span>
              <div className="mt-1 space-y-1">
                <Link
                  to="/skills"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <GitBranch className="h-4 w-4 text-emerald-600" />
                  <span>{t.nav.skills}</span>
                </Link>
                <Link
                  to="/readiness"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <Target className="h-4 w-4 text-amber-600" />
                  <span>{t.nav.readiness}</span>
                </Link>
                <Link
                  to="/profile/portfolio-settings"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <Award className="h-4 w-4 text-purple-600" />
                  <span>{t.nav.portfolio}</span>
                </Link>
              </div>
            </div>

            {/* Community & Enterprise */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3">
                {t.nav.communityMenu} & B2B
              </span>
              <div className="mt-1 space-y-1">
                <Link
                  to="/mentors"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <Video className="h-4 w-4 text-slate-600" />
                  <span>{t.nav.mentors}</span>
                </Link>
                <Link
                  to="/b2b/dashboard"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <Building className="h-4 w-4 text-slate-600" />
                  <span>{t.nav.b2b}</span>
                </Link>
                <Link
                  to="/pricing"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <CreditCard className="h-4 w-4 text-slate-600" />
                  <span>{t.nav.pricing}</span>
                </Link>
              </div>
            </div>

            {/* Admin Section */}
            {isAdmin && (
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 px-3">
                  {t.nav.admin}
                </span>
                <div className="mt-1 space-y-1">
                  <Link
                    to="/admin/users"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-purple-900 hover:bg-purple-50"
                  >
                    <Users className="h-4 w-4 text-purple-600" />
                    <span>{t.nav.users}</span>
                  </Link>
                  <Link
                    to="/admin/ai-runs"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-purple-900 hover:bg-purple-50"
                  >
                    <Activity className="h-4 w-4 text-purple-600" />
                    <span>{t.nav.aiTelemetry}</span>
                  </Link>
                  <Link
                    to="/admin/prompts"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-purple-900 hover:bg-purple-50"
                  >
                    <FileText className="h-4 w-4 text-purple-600" />
                    <span>{t.nav.prompts}</span>
                  </Link>
                  <Link
                    to="/admin/ai-eval"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-purple-900 hover:bg-purple-50"
                  >
                    <TestTube className="h-4 w-4 text-purple-600" />
                    <span>{t.nav.evalHarness}</span>
                  </Link>
                </div>
              </div>
            )}

            {/* Logout Mobile */}
            <div className="pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>{t.nav.signOut}</span>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}
    </header>
  );
}
