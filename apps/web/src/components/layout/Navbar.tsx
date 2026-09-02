import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth.store';
import { useI18nStore } from '../../stores/i18n.store';
import { UserRole, SubscriptionResponse } from '@ai-interview/contracts';
import { apiClient } from '../../lib/api-client';
import { Button } from '../ui/Button';
import { XpProgressWidget } from '../../features/gamification/components/XpProgressWidget';
import { useGamificationStore } from '../../stores/gamification.store';
import { getNextUpgradePlan } from '../../lib/plan-tier.utils';
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
  Shield,
  LayoutDashboard,
  Volume2,
  VolumeX,
  Trophy,
  Sparkles,
  Crown,
  Layers,
  Bookmark,
  TrendingUp,
  Boxes,
  Cpu,
} from 'lucide-react';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { language, setLanguage, t } = useI18nStore();
  const { sfxMuted, toggleSfx } = useGamificationStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [progressMenuOpen, setProgressMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const progressRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const adminRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setProgressMenuOpen(false);
    setToolsMenuOpen(false);
    setAdminOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (progressRef.current && !progressRef.current.contains(target)) {
        setProgressMenuOpen(false);
      }
      if (toolsRef.current && !toolsRef.current.contains(target)) {
        setToolsMenuOpen(false);
      }
      if (adminRef.current && !adminRef.current.contains(target)) {
        setAdminOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape key to close open menus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setProgressMenuOpen(false);
        setToolsMenuOpen(false);
        setAdminOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'vi' ? 'en' : 'vi');
  };

  const { data: subscription } = useQuery<SubscriptionResponse>({
    queryKey: ['billing', 'subscription'],
    queryFn: () => apiClient<SubscriptionResponse>('/billing/subscription'),
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  const isAdmin = user?.role === UserRole.ADMIN;
  const isTenantUser = Boolean((user as any)?.tenantId);
  const planSlug = subscription?.plan?.slug?.toLowerCase() || 'free';

  const getAvatarTierConfig = (slug: string, admin?: boolean) => {
    if (admin) {
      return {
        border:
          'ring-2 ring-rose-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 shadow-[0_0_10px_rgba(244,63,94,0.35)]',
        bg: 'bg-gradient-to-tr from-rose-600 to-pink-500',
        badgeIcon: '🛡️',
        badgeTitle: 'Quản trị viên (Admin)',
        badgeBg: 'bg-rose-600 text-white border-white dark:border-slate-900',
        tierLabel: 'ADMIN',
      };
    }
    switch (slug) {
      case 'enterprise':
      case 'team':
      case 'b2b':
        return {
          border:
            'ring-2 ring-purple-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 shadow-[0_0_10px_rgba(168,85,247,0.35)]',
          bg: 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-sky-500',
          badgeIcon: '⚡',
          badgeTitle: 'Gói Doanh Nghiệp (Enterprise)',
          badgeBg: 'bg-purple-600 text-white border-white dark:border-slate-900',
          tierLabel: 'TEAM',
        };
      case 'pro':
        return {
          border:
            'ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 shadow-[0_0_10px_rgba(245,158,11,0.4)]',
          bg: 'bg-gradient-to-tr from-amber-500 via-yellow-500 to-emerald-500',
          badgeIcon: '👑',
          badgeTitle: 'Gói Pro AI Mastery',
          badgeBg: 'bg-amber-500 text-slate-950 border-white dark:border-slate-900',
          tierLabel: 'PRO',
        };
      default:
        return {
          border:
            'ring-2 ring-emerald-500/80 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 shadow-[0_0_8px_rgba(16,185,129,0.25)]',
          bg: 'bg-gradient-to-tr from-emerald-600 to-teal-500',
          badgeIcon: '⭐',
          badgeTitle: 'Gói Miễn Phí (Free)',
          badgeBg: 'bg-emerald-600 text-white border-white dark:border-slate-900',
          tierLabel: 'FREE',
        };
    }
  };

  const avatarTier = getAvatarTierConfig(planSlug, isAdmin);
  const upgradeSuggestion = getNextUpgradePlan(planSlug, isAdmin, language === 'vi');

  // Active state helpers
  const isDashboardActive = location.pathname === '/';
  const isPracticeActive = location.pathname.startsWith('/interviews');
  const isQuestionBankActive = location.pathname.startsWith('/question-bank');
  const isArenaActive = location.pathname.startsWith('/arena');
  const isProgressActive =
    location.pathname.startsWith('/readiness') ||
    location.pathname.startsWith('/skills') ||
    location.pathname === '/history';
  const isToolsActive =
    location.pathname.startsWith('/flashcards') ||
    location.pathname.startsWith('/mentors') ||
    location.pathname.startsWith('/mentor') ||
    location.pathname.startsWith('/b2b');
  const isAdminActive = location.pathname.startsWith('/admin');

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs dark:bg-slate-900/95 dark:border-slate-800">
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* ========================================================= */}
        {/* LEFT: BRAND LOGO + ENLARGED ELONGATED NAVIGATION TABS      */}
        {/* ========================================================= */}
        <div className="flex items-center gap-4 lg:gap-6 shrink-0 min-w-0">
          {/* Brand Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-xl p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 whitespace-nowrap shrink-0 group"
            title={t.nav.brand}
            aria-label={t.nav.brand}
          >
            <div className="bg-gradient-to-tr from-emerald-600 to-teal-500 text-white p-2 rounded-xl shadow-xs flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <span className="hidden sm:inline-block text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white shrink-0">
              AI Interview
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          {isAuthenticated && (
            <nav className="hidden xl:flex items-center gap-1.5" aria-label="Main Navigation">
              {/* 1. Dashboard */}
              <Link
                to="/"
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                  isDashboardActive
                    ? 'bg-slate-100 text-slate-900 font-bold shadow-2xs dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60'
                }`}
              >
                <span>{language === 'vi' ? 'Tổng quan' : 'Dashboard'}</span>
              </Link>

              {/* 2. Practice (Primary Action) */}
              <Link
                to="/interviews/new"
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                  isPracticeActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:scale-[1.02] active:scale-[0.98] dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60'
                }`}
              >
                <PlayCircle className="h-4 w-4" />
                <span>{t.nav.newInterview}</span>
              </Link>

              {/* 3. Question Bank */}
              <Link
                to="/question-bank"
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                  isQuestionBankActive
                    ? 'bg-slate-100 text-slate-900 font-bold shadow-2xs dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60'
                }`}
              >
                <Layers className="h-4 w-4 text-indigo-500" />
                <span>{language === 'vi' ? 'Ngân hàng câu hỏi' : 'Question Bank'}</span>
              </Link>

              {/* 3b. Engineering Arena */}
              <Link
                to="/arena"
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                  isArenaActive
                    ? 'bg-slate-100 text-slate-900 font-bold shadow-2xs dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60'
                }`}
              >
                <Cpu className="h-4 w-4 text-cyan-500" />
                <span>{language === 'vi' ? 'Đấu trường Kỹ thuật' : 'Engineering Arena'}</span>
              </Link>

              {/* 4. Progress Dropdown */}
              <div className="relative" ref={progressRef}>
                <button
                  type="button"
                  onClick={() => {
                    setProgressMenuOpen(!progressMenuOpen);
                    setToolsMenuOpen(false);
                    setAdminOpen(false);
                    setUserMenuOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                    isProgressActive
                      ? 'bg-slate-100 text-slate-900 font-bold shadow-2xs dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60'
                  }`}
                  aria-expanded={progressMenuOpen}
                  aria-haspopup="true"
                >
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span>{language === 'vi' ? 'Tiến độ' : 'Progress'}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
                </button>

                {progressMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-slide-up dark:bg-slate-800 dark:border-slate-700">
                    <div className="px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {language === 'vi' ? 'Theo dõi năng lực' : 'Performance Tracking'}
                    </div>

                    <Link
                      to="/readiness"
                      className="flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-slate-700/60"
                    >
                      <Target className="h-4 w-4 text-amber-500" />
                      <span>{t.nav.readiness}</span>
                    </Link>

                    <Link
                      to="/skills"
                      className="flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-slate-700/60"
                    >
                      <GitBranch className="h-4 w-4 text-emerald-600" />
                      <span>{t.nav.skills}</span>
                    </Link>

                    <Link
                      to="/history"
                      className="flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-slate-700/60"
                    >
                      <History className="h-4 w-4 text-slate-500" />
                      <span>{t.nav.history}</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* 5. Tools Dropdown */}
              <div className="relative" ref={toolsRef}>
                <button
                  type="button"
                  onClick={() => {
                    setToolsMenuOpen(!toolsMenuOpen);
                    setProgressMenuOpen(false);
                    setAdminOpen(false);
                    setUserMenuOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                    isToolsActive
                      ? 'bg-slate-100 text-slate-900 font-bold shadow-2xs dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60'
                  }`}
                  aria-expanded={toolsMenuOpen}
                  aria-haspopup="true"
                >
                  <Boxes className="h-4 w-4 text-indigo-500" />
                  <span>{language === 'vi' ? 'Công cụ' : 'Tools'}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
                </button>

                {toolsMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-slide-up dark:bg-slate-800 dark:border-slate-700">
                    <div className="px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {language === 'vi' ? 'Công cụ nâng cao' : 'Advanced Tools'}
                    </div>

                    <Link
                      to="/flashcards"
                      className="flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-slate-700/60"
                    >
                      <BookOpen className="h-4 w-4 text-indigo-600" />
                      <span>{t.nav.flashcards}</span>
                    </Link>

                    <Link
                      to="/question-bank/bookmarks"
                      className="flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-slate-700/60"
                    >
                      <Bookmark className="h-4 w-4 text-amber-500" />
                      <span>{language === 'vi' ? 'Câu hỏi đã lưu' : 'Bookmarked Questions'}</span>
                    </Link>

                    <Link
                      to="/mentors"
                      className="flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-slate-700/60"
                    >
                      <Video className="h-4 w-4 text-rose-600" />
                      <span>{t.nav.mentors}</span>
                    </Link>

                    {(isTenantUser || isAdmin) && (
                      <>
                        <div className="border-t border-slate-100 my-1 dark:border-slate-700" />
                        <Link
                          to="/b2b/dashboard"
                          className="flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-slate-700/60"
                        >
                          <Building className="h-4 w-4 text-sky-600" />
                          <span>{t.nav.b2b}</span>
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* 6. Admin Menu */}
              {isAdmin && (
                <div
                  className="relative ml-1 pl-1 border-l border-slate-200 dark:border-slate-700"
                  ref={adminRef}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAdminOpen(!adminOpen);
                      setProgressMenuOpen(false);
                      setToolsMenuOpen(false);
                      setUserMenuOpen(false);
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                      isAdminActive
                        ? 'bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300'
                        : 'text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/40'
                    }`}
                    aria-expanded={adminOpen}
                    aria-haspopup="true"
                  >
                    <Shield className="h-4 w-4" />
                    <span>{t.nav.admin}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
                  </button>

                  {adminOpen && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-purple-100 py-2 z-50 animate-slide-up dark:bg-slate-800 dark:border-purple-900/40">
                      <div className="px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                        {language === 'vi' ? 'Khu vực quản trị' : 'Admin Control Panel'}
                      </div>

                      <Link
                        to="/admin/users"
                        className="flex items-center gap-2.5 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-900 dark:text-slate-200 dark:hover:bg-purple-950/40"
                      >
                        <Users className="h-4 w-4 text-purple-600" />
                        <span>{t.nav.users}</span>
                      </Link>
                      <Link
                        to="/admin/question-bank"
                        className="flex items-center gap-2.5 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-900 dark:text-slate-200 dark:hover:bg-purple-950/40"
                      >
                        <Layers className="h-4 w-4 text-purple-600" />
                        <span>{language === 'vi' ? 'Ngân hàng câu hỏi' : 'Question Bank'}</span>
                      </Link>
                      <Link
                        to="/admin/ai-runs"
                        className="flex items-center gap-2.5 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-900 dark:text-slate-200 dark:hover:bg-purple-950/40"
                      >
                        <Activity className="h-4 w-4 text-purple-600" />
                        <span>{t.nav.aiTelemetry}</span>
                      </Link>
                      <Link
                        to="/admin/prompts"
                        className="flex items-center gap-2.5 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-900 dark:text-slate-200 dark:hover:bg-purple-950/40"
                      >
                        <FileText className="h-4 w-4 text-purple-600" />
                        <span>{t.nav.prompts}</span>
                      </Link>
                      <Link
                        to="/admin/ai-eval"
                        className="flex items-center gap-2.5 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-900 dark:text-slate-200 dark:hover:bg-purple-950/40"
                      >
                        <TestTube className="h-4 w-4 text-purple-600" />
                        <span>{t.nav.evalHarness}</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </nav>
          )}

          {/* Compact Tablet Navigation (1024px - 1279px) */}
          {isAuthenticated && (
            <nav
              className="hidden lg:flex xl:hidden items-center gap-1.5"
              aria-label="Tablet Navigation"
            >
              <Link
                to="/interviews/new"
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl bg-emerald-600 text-white shadow-xs whitespace-nowrap"
              >
                <PlayCircle className="h-4 w-4" />
                <span>{t.nav.newInterview}</span>
              </Link>

              <Link
                to="/question-bank"
                className="px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <span>{language === 'vi' ? 'Câu hỏi' : 'Questions'}</span>
              </Link>

              <Link
                to="/readiness"
                className="px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <span>{language === 'vi' ? 'Tiến độ' : 'Progress'}</span>
              </Link>
            </nav>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT: ACTION TOOLBAR (UPGRADE + LANG + GAMIFICATION + USER)*/}
        {/* ========================================================= */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          {/* Quick Upgrade Pill (Suggested next higher tier; hidden if on highest tier) */}
          {isAuthenticated && upgradeSuggestion.hasHigherPlan && (
            <Link
              to={`/pricing?plan=${upgradeSuggestion.targetPlanSlug}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs sm:text-sm font-extrabold bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-teal-500/15 border border-amber-400/60 hover:border-emerald-500 text-slate-800 shadow-2xs hover:shadow-xs transition-all duration-200 group dark:text-white shrink-0 hover:scale-105 active:scale-95"
              title={upgradeSuggestion.headerPillLabel}
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 group-hover:scale-110 group-hover:rotate-12 transition-transform" />
              <span className="bg-gradient-to-r from-amber-700 via-emerald-700 to-teal-700 bg-clip-text text-transparent font-black dark:from-amber-300 dark:via-emerald-300 dark:to-teal-300">
                {upgradeSuggestion.buttonLabel}
              </span>
            </Link>
          )}

          {/* Language Switcher */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            title={
              language === 'vi'
                ? 'Chuyển sang Tiếng Anh (English)'
                : 'Switch to Vietnamese (Tiếng Việt)'
            }
          >
            <Globe className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span>{language === 'vi' ? 'VI' : 'EN'}</span>
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
              {/* Gamification Level & Streak Widget */}
              <div className="hidden sm:block shrink-0">
                <XpProgressWidget />
              </div>

              {/* User Avatar Menu Dropdown with Plan Tier Ring & Dropdown Indicator */}
              <div className="relative shrink-0" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(!userMenuOpen);
                    setProgressMenuOpen(false);
                    setToolsMenuOpen(false);
                    setAdminOpen(false);
                  }}
                  className="flex items-center gap-1.5 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 group cursor-pointer"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  aria-label="User Profile Menu"
                  title={user?.profile?.fullName || user?.email || 'User Menu'}
                >
                  <div className="relative">
                    <div
                      className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full ${avatarTier.bg} ${avatarTier.border} text-white flex items-center justify-center text-xs font-bold shadow-xs group-hover:scale-105 transition-transform shrink-0`}
                    >
                      {(user?.profile?.fullName || user?.email || 'U')[0].toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ${avatarTier.badgeBg} flex items-center justify-center text-[8px] font-black border shadow-xs leading-none select-none`}
                      title={avatarTier.badgeTitle}
                    >
                      {avatarTier.badgeIcon}
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-transform duration-200 ${
                      userMenuOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''
                    }`}
                  />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-slide-up dark:bg-slate-800 dark:border-slate-700">
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {user?.profile?.fullName || 'Candidate'}
                        </p>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                            isAdmin
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              : planSlug === 'pro'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/50'
                                : planSlug === 'team' || planSlug === 'enterprise'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}
                        >
                          {avatarTier.tierLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {user?.email}
                      </p>
                    </div>

                    {/* Upgrade / Tier Status Box in Dropdown */}
                    <div
                      className={`p-3 mx-2.5 my-2 rounded-xl text-white shadow-xs space-y-1.5 ${
                        upgradeSuggestion.hasHigherPlan
                          ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 border border-emerald-500/30'
                          : 'bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 border border-purple-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Crown className="h-4 w-4 text-amber-400" />
                          <span className="text-xs font-extrabold text-amber-300">
                            {upgradeSuggestion.boxTitle}
                          </span>
                        </div>
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                          {upgradeSuggestion.boxBadge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-tight">
                        {upgradeSuggestion.boxDescription}
                      </p>
                      {upgradeSuggestion.hasHigherPlan && (
                        <Link
                          to={`/pricing?plan=${upgradeSuggestion.targetPlanSlug}`}
                          onClick={() => setUserMenuOpen(false)}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 transition-all shadow-xs active:scale-[0.98]"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-900" />
                          <span>{upgradeSuggestion.ctaText}</span>
                        </Link>
                      )}
                    </div>

                    <Link
                      to="/gamification/badges"
                      className="flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-slate-700/60"
                    >
                      <Trophy className="h-4 w-4 text-amber-500" />
                      <span>
                        {language === 'vi' ? 'Huy hiệu & Thành tựu' : 'Badges & Achievements'}
                      </span>
                    </Link>

                    <Link
                      to="/gamification/leaderboard"
                      className="flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-slate-700/60"
                    >
                      <Award className="h-4 w-4 text-emerald-600" />
                      <span>{language === 'vi' ? 'Bảng xếp hạng' : 'Leaderboard'}</span>
                    </Link>

                    <Link
                      to="/profile"
                      className="flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-slate-700/60"
                    >
                      <User className="h-4 w-4 text-slate-400" />
                      <span>{t.nav.profile}</span>
                    </Link>

                    <Link
                      to="/profile/portfolio-settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-slate-700/60"
                    >
                      <Shield className="h-4 w-4 text-slate-400" />
                      <span>{t.nav.portfolio}</span>
                    </Link>

                    <Link
                      to="/billing"
                      className="flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-slate-700/60"
                    >
                      <CreditCard className="h-4 w-4 text-slate-400" />
                      <span>{t.nav.billing}</span>
                    </Link>

                    <div className="border-t border-slate-100 my-1 dark:border-slate-700" />

                    {/* Quick SFX Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleSfx()}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors dark:text-slate-300 dark:hover:bg-slate-700/60"
                      data-testid="sfx-toggle-btn"
                    >
                      <div className="flex items-center gap-3">
                        {sfxMuted ? (
                          <VolumeX className="h-4 w-4 text-slate-400" />
                        ) : (
                          <Volume2 className="h-4 w-4 text-emerald-600" />
                        )}
                        <span>{language === 'vi' ? 'Hiệu ứng âm thanh' : 'Sound Effects'}</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                          sfxMuted
                            ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {sfxMuted
                          ? language === 'vi'
                            ? 'TẮT'
                            : 'OFF'
                          : language === 'vi'
                            ? 'BẬT'
                            : 'ON'}
                      </span>
                    </button>

                    <div className="border-t border-slate-100 my-1 dark:border-slate-700" />

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors dark:hover:bg-rose-950/40"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{t.nav.signOut}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Hamburger Toggle (Visible on lg: and below) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Toggle mobile menu"
                aria-expanded={mobileMenuOpen}
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

      {/* ========================================================= */}
      {/* MOBILE DRAWER NAVIGATION                                  */}
      {/* ========================================================= */}
      {mobileMenuOpen && isAuthenticated && (
        <div className="lg:hidden fixed inset-0 top-16 z-50 bg-slate-900/50 backdrop-blur-xs flex flex-col justify-between animate-fade-in">
          <div className="bg-white border-b border-slate-200 p-4 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl dark:bg-slate-900 dark:border-slate-800">
            {/* Primary Candidate Navigation */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3">
                {language === 'vi' ? 'Hành trình Luyện tập' : 'Candidate Practice'}
              </span>
              <div className="mt-1 space-y-1">
                <Link
                  to="/"
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-200 dark:hover:bg-emerald-950/40"
                >
                  <LayoutDashboard className="h-4 w-4 text-emerald-600" />
                  <span>{language === 'vi' ? 'Tổng quan' : 'Dashboard'}</span>
                </Link>
                <Link
                  to="/interviews/new"
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  <PlayCircle className="h-4 w-4 text-emerald-600" />
                  <span>{t.nav.newInterview}</span>
                </Link>
                <Link
                  to="/question-bank"
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-200 dark:hover:bg-emerald-950/40"
                >
                  <Layers className="h-4 w-4 text-indigo-600" />
                  <span>{language === 'vi' ? 'Ngân hàng câu hỏi' : 'Question Bank'}</span>
                </Link>
                <Link
                  to="/arena"
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-200 dark:hover:bg-emerald-950/40"
                >
                  <Cpu className="h-4 w-4 text-cyan-600" />
                  <span>{language === 'vi' ? 'Đấu trường Kỹ thuật' : 'Engineering Arena'}</span>
                </Link>
                <Link
                  to="/readiness"
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-200 dark:hover:bg-emerald-950/40"
                >
                  <Target className="h-4 w-4 text-amber-600" />
                  <span>{t.nav.readiness}</span>
                </Link>
                <Link
                  to="/history"
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-200 dark:hover:bg-emerald-950/40"
                >
                  <History className="h-4 w-4 text-slate-600" />
                  <span>{t.nav.history}</span>
                </Link>
              </div>
            </div>

            {/* Advanced Practice Section */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3">
                {language === 'vi' ? 'Tính năng Mở rộng' : 'Advanced Tools'}
              </span>
              <div className="mt-1 space-y-1">
                <Link
                  to="/flashcards"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-200 dark:hover:bg-emerald-950/40"
                >
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  <span>{t.nav.flashcards}</span>
                </Link>
                <Link
                  to="/question-bank/bookmarks"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-200 dark:hover:bg-emerald-950/40"
                >
                  <Bookmark className="h-4 w-4 text-amber-500" />
                  <span>{language === 'vi' ? 'Câu hỏi đã lưu' : 'Bookmarked Questions'}</span>
                </Link>
                <Link
                  to="/skills"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-200 dark:hover:bg-emerald-950/40"
                >
                  <GitBranch className="h-4 w-4 text-emerald-600" />
                  <span>{t.nav.skills}</span>
                </Link>
                <Link
                  to="/mentors"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-200 dark:hover:bg-emerald-950/40"
                >
                  <Video className="h-4 w-4 text-rose-600" />
                  <span>{t.nav.mentors}</span>
                </Link>
                <Link
                  to="/pricing"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-200 dark:hover:bg-emerald-950/40"
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
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-purple-900 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/40"
                  >
                    <Users className="h-4 w-4 text-purple-600" />
                    <span>{t.nav.users}</span>
                  </Link>
                  <Link
                    to="/admin/question-bank"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-purple-900 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/40"
                  >
                    <Layers className="h-4 w-4 text-purple-600" />
                    <span>{language === 'vi' ? 'Ngân hàng câu hỏi' : 'Question Bank'}</span>
                  </Link>
                  <Link
                    to="/admin/ai-runs"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-purple-900 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/40"
                  >
                    <Activity className="h-4 w-4 text-purple-600" />
                    <span>{t.nav.aiTelemetry}</span>
                  </Link>
                  <Link
                    to="/admin/prompts"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-purple-900 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/40"
                  >
                    <FileText className="h-4 w-4 text-purple-600" />
                    <span>{t.nav.prompts}</span>
                  </Link>
                  <Link
                    to="/admin/ai-eval"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-purple-900 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/40"
                  >
                    <TestTube className="h-4 w-4 text-purple-600" />
                    <span>{t.nav.evalHarness}</span>
                  </Link>
                </div>
              </div>
            )}

            {/* SFX and Logout Mobile */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
              <button
                type="button"
                onClick={() => toggleSfx()}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg text-slate-700 hover:bg-slate-50 transition-colors dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-2.5">
                  {sfxMuted ? (
                    <VolumeX className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-emerald-600" />
                  )}
                  <span>{language === 'vi' ? 'Hiệu ứng âm thanh' : 'Sound Effects'}</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${
                    sfxMuted
                      ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {sfxMuted
                    ? language === 'vi'
                      ? 'TẮT'
                      : 'OFF'
                    : language === 'vi'
                      ? 'BẬT'
                      : 'ON'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors dark:hover:bg-rose-950/40"
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

export default Navbar;
