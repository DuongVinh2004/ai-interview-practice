import { Outlet, Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { OfflineBanner } from '../common/OfflineBanner';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { Bot, Shield, CheckCircle2, Minimize2 } from 'lucide-react';
import { useI18nStore } from '../../stores/i18n.store';
import { useFocusModeStore } from '../../stores/focus-mode.store';
import { LevelUpModal } from '../../features/gamification/components/LevelUpModal';
import { BadgeUnlockToast } from '../../features/gamification/components/BadgeUnlockToast';
import { PwaInstallPrompt } from '../../features/pwa/components/PwaInstallPrompt';
import { PushNotificationPrompt } from '../../features/notifications/PushNotificationPrompt';

export function AppLayout() {
  const { t, language } = useI18nStore();
  const { isFocusMode, setFocusMode } = useFocusModeStore();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      {/* Skip to Main Content Link for Keyboard Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-emerald-600 focus:text-white focus:font-semibold focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-emerald-400 focus:outline-none"
      >
        {language === 'vi' ? 'Chuyển đến nội dung chính' : 'Skip to main content'}
      </a>

      {!isFocusMode && <OfflineBanner />}
      {!isFocusMode && <Navbar />}

      {/* Floating Exit Focus Mode Button */}
      {isFocusMode && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in duration-200">
          <button
            type="button"
            onClick={() => setFocusMode(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-bold shadow-lg border border-slate-700 backdrop-blur-md transition-all hover:scale-105"
            title="Thoát chế độ tập trung (Esc / F11)"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Thoát Focus Mode (Esc)' : 'Exit Focus (Esc)'}</span>
          </button>
        </div>
      )}

      {/* Main Content Landmark with focusable anchor */}
      <main
        id="main-content"
        tabIndex={-1}
        className={`flex-1 w-full mx-auto focus:outline-none animate-fade-in ${
          isFocusMode ? 'p-2 sm:p-4 max-w-7xl' : 'max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8'
        }`}
      >
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Unified Application Footer */}
      {!isFocusMode && (
        <footer className="bg-white border-t border-slate-200 py-8 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left font-semibold text-slate-700">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-600 text-white p-1 rounded-md">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <span>{t.nav.brand}</span>
            </div>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="text-slate-500 font-normal">
              {language === 'vi'
                ? 'Nền tảng luyện tập phỏng vấn kỹ thuật AI thích ứng'
                : 'Adaptive AI Mock Technical Interview Platform'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 text-[11px] font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>{language === 'vi' ? 'Hệ thống AI Hoạt động' : 'AI System Online'}</span>
            </div>
            <Link to="/pricing" className="hover:text-slate-800 transition-colors">
              {t.nav.pricing}
            </Link>
            <div className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors">
              <Shield className="h-3.5 w-3.5 text-slate-400" />
              <span>GDPR / 2FA</span>
            </div>
          </div>
        </div>
        
      {/* Practice-only disclaimer notice in footer */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
          {language === 'vi'
            ? 'Lưu ý: Mọi đánh giá và điểm số được tạo bởi AI chỉ mang tính chất định hướng luyện tập và phát triển kỹ năng, không phải quyết định tuyển dụng chính thức.'
            : 'Disclaimer: All AI-generated evaluations and rubrics are designed solely for practice and self-improvement, not formal hiring decisions.'}
        </div>
      </footer>
      )}

      {/* Plan C Overlays & Modals */}
      <LevelUpModal />
      <BadgeUnlockToast />
      <PwaInstallPrompt />
      <PushNotificationPrompt />
    </div>
  );
}

export default AppLayout;
